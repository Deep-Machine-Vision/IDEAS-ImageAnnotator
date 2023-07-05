import io
import time

import numpy as np
import cv2

from api.data_manipulation import raw_to_pil_image, sem_raw_to_numpy, prepare_obj_class_dict, init_mask_from_points
from api.data_manipulation import refine_mask_grabcut, connectivity
from api.data_manipulation import construct_label, create_xml
from api.data_manipulation import isPixelInBbox
from config import cfg

if cfg.DL_obj_sel_en:
    # from DLearning_PosNeg_select import Setup_environment, DLearning_PosNeg
    # global DLsession, DLinput, DLoutput
    # DLsession, DLinput, DLoutput = Setup_environment()

    from DLearning_PosNeg_select import Setup_environment_seg, DLearning_PosNeg
    global DLsession, DLinput, DLoutput
    DLsession, DLinput, DLoutput = Setup_environment_seg()

import xml.etree.cElementTree as ET
from flask import Flask, make_response, render_template, request, json, jsonify #, send_file
app = Flask(__name__)

@app.route("/")
def home():
    return render_template('generic.html')

@app.route("/help")
def help():
    print('try to render help page')
    return render_template('help.html')

@app.route("/handle_action", methods=['POST'])
def handle_action():
    if cfg.MONITOR_TIME:
        print("   ## Start one process ...")
        prt_time = [('', time.time())]

    metaData = request.get_json()

    if cfg.DBG_PRT:
        prt_time.append(('       : -- get json done: ', time.time()))

    rawData  = metaData['image']  # input RGB image
    semData = metaData['sem']     # semantic data
    prevDict = metaData['prev']   # annotation record from last step.
    color    = metaData['color']  # false color for current object-class
    mode     = metaData['mode']   # Algorithm mode
    obj      = metaData['obj']    # current object annotating on.
    clsname  = metaData['cls']    # current class annotating on
    bbox     = metaData['bbox']   # bounding box to limit processing area in grabcut
    pos_pts  = metaData['pos']    # positive markers for DL object select model
    neg_pts  = metaData['neg']    # negative markers for DL object select model

    # decode stroke points and bbox
    bbox = [bbox['start_x'],
            bbox['start_y'],
            bbox['end_x'],
            bbox['end_y']]
    bx0, by0, bx1, by1 = bbox
    pos_pts  = np.asarray([[v['y']-by0, v['x']-bx0] for v in pos_pts \
                                    if isPixelInBbox(v['x'], v['y'], bx0, by0, bx1, by1)])
    neg_pts  = np.asarray([[v['y']-by0, v['x']-bx0] for v in neg_pts\
                                    if isPixelInBbox(v['x'], v['y'], bx0, by0, bx1, by1)])

    if (len(pos_pts) <= cfg.GC_iter_count) or obj == None:
        return json.dumps({'success':False, 'message': 'Foreground points are not enough.'}),\
                          400, {'ContentType':'application/json'}

    # Decode original image to numpy array
    img    = raw_to_pil_image(rawData)
    imgArr = np.array(img)
    h, w   = imgArr.shape[:2]
    imgArr = imgArr[:,:,:3]

    semArr = sem_raw_to_numpy(semData, imgArr)
    semArr = semArr[by0:by1, bx0:bx1]
    semh, semw = semArr.shape[:2]

    # use a blank semantic map if there is a mismatch between semantic map and rgb image size.
    if semh != h or semw != w:
        print("Initiating a blank mask.")
        semArr = np.zeros((h, w))
        semh, semw = semArr.shape[:2]

    assert(semh==h)
    assert(semw==w)

    if len(semArr.shape)==2:
        semInput = semArr
    elif semArr.shape[2]==1:
        semInput = semArr[:,:,0]
    else:
        cands = np.argmax(semArr[pos_pts[:,0], pos_pts[:,1]], axis=-1)
        ch = np.argmax(np.bincount(cands))
        semInput = semArr[:,:,ch]

    if cfg.DBG_PRT:
        prt_time.append(('       : -- parse image finished: ', time.time()))

    # initial object-class dict
    prepare_obj_class_dict(obj, clsname, color, prevDict)

    # points to construct initial mask
    if mode == "GrabCut":
        mask = refine_mask_grabcut(imgArr,
                                   np.zeros([h, w], dtype=np.uint8),
                                   cfg.GC_iter_count)
        mask = connectivity(mask,
                            pos_pts,
                            sx=0, sy=0)
        outputMask = mask

    elif mode == "Manual":
        mask = init_mask_from_points(np.zeros((h, w), dtype=np.uint8),
                                     pos_pts,
                                     sx=0, sy=0)
        outputMask = mask

    elif mode == "DL-ObjectSelect":
        # TODO : Modify this.
        # from tifffile import imread
        # semInput = imread('../sgis-itis/data/semantic_results_instance/2008_003331_1.tif')

        if cfg.DL_obj_sel_en:
            if (len(neg_pts) <= cfg.GC_iter_count):
                return json.dumps({'success':False, 'message': 'Neg points are not enough.'}),\
                                   400, {'ContentType':'application/json'}
            crop_box, dpMask = DLearning_PosNeg(DLsession,
                                                semInput,
                                                DLinput,
                                                DLoutput,
                                                pos_pts,
                                                neg_pts,
                                                imgArr,
                                                negBbox=False)
            if cfg.DBG_PRT:
                prt_time.append(('       : -- DL done: ', time.time()))
            x0,y0,x1,y1 = crop_box
            boxMask = refine_mask_grabcut(imgArr[y0:y1, x0:x1, :],
                                          dpMask.astype('uint8'),
                                          cfg.GC_iter_count)
            if cfg.DBG_PRT:
                prt_time.append(('       : -- (DL & grabCut) done: ', time.time()))

            boxMask = connectivity(boxMask,
                                   pos_pts-np.asarray([[y0, x0]]),
                                   sx=0, sy=0)
            if cfg.DBG_PRT:
                prt_time.append(('       : -- (DL & grabCut & conn) done: ', time.time()))

            outputMask = np.zeros(imgArr.shape[:2], dtype=np.uint8)
            outputMask[y0:y1, x0:x1] = boxMask
        else:
            # labeling of existing annotation.
            mask = np.zeros((h, w), dtype=np.uint8)
            mask = init_mask_from_points(mask, pos_pts)
            outputMask = cv2.dilate(mask, np.ones([13, 13], np.uint8), iterations=1)

    else:
        return json.dumps({'success':False, 'message': 'Invalid mode.'}), \
               400, {'ContentType':'application/json'}

    # add mask from one step to whole mask
    construct_label(outputMask, prevDict, obj, clsname, sx=bx0, sy=by0)

    if cfg.MONITOR_TIME:
        prt_time.append(('       : -- construct label : ', time.time()))
        print('   -- image: ', metaData['fname'])
        print('   ## one process finished', prt_time[-1][1] - prt_time[0][1])
        if cfg.DBG_PRT:
            for k in range(1, len(prt_time)):
                print(prt_time[k][0], prt_time[k][1] - prt_time[k-1][1])

    return jsonify({'label': prevDict})


@app.route("/label_parse", methods=['POST'])
def label_parse():
    metaData = request.get_json()
    rawData  = metaData['image']  # label image with obj-cls-uid
    prevDict = metaData['prev']   # annotation record from last step.
    hierDict = metaData['hier']   # annotation record from last step.

    img    = raw_to_pil_image(rawData)
    imgArr = np.array(img)
    labelI = imgArr[...,0]

    for uid in np.unique(labelI):
        if str(uid) in hierDict:
            objName, clsName, color = hierDict[str(uid)]
            prepare_obj_class_dict(objName, clsName, color, prevDict)
            # add mask from one step to whole mask
            construct_label((labelI==uid).astype(np.uint8), prevDict,
                            objName, clsName, sx=0, sy=0)

    return jsonify({'label': prevDict})


@app.route("/xml_saver", methods=['POST'])
def xml_saver():
    metaData = request.get_json()
    root = ET.Element("annotator")

    create_xml(metaData, root)
    tree = ET.ElementTree(root)

    f = io.BytesIO()
    tree.write(f, encoding='utf-8', xml_declaration=True)
    xmlstr = f.getvalue()  # your XML file, encoded as UTF-8
    #tree.write('test.xml')
    response = make_response(xmlstr)
    # This is the key: Set the right header for the response
    # to be downloaded, instead of just printed on the browser
    response.headers["Content-disposition"] = "attachment;"
    response.mimetype="application/xml"

    # tree.write('test.xml')

    return response

if __name__ == "__main__":
    from waitress import serve
    serve(app, host="0.0.0.0", port=5000)
