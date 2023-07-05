import cv2
import numpy as np
from PIL import Image
from skimage import measure as smeasure
import io
import base64
import traceback
#from collections import deque
import xml.etree.cElementTree as ET
from tifffile import imread

def raw_to_pil_image(raw):
    if ('base64' not in raw) or (',' not in raw):
        return None
    idx = raw.index(',')
    imgData = raw[idx+1:]   
    fp = io.BytesIO(base64.b64decode(imgData))
    img = Image.open(fp)
    return img

def sem_raw_to_numpy(raw, imgArr):
    if ('base64' not in raw) or (',' not in raw):
        return None
    idx = raw.index(',')
    imgData = raw[idx+1:]
    fp = io.BytesIO(bytearray(base64.b64decode(imgData)))
    try:
        img = imread(fp)
    except:
        print("Initializing with a blank mask.")
        h, w   = imgArr.shape[:2]
        img = np.zeros((h, w))
    return img

def prepare_obj_class_dict(obj, cls, color, prevDict):
    if obj not in prevDict['pos']:
        prevDict['pos'][obj]    = {}
        prevDict['edge'][obj]   = {}
        prevDict['locked'][obj] = {}
        prevDict['numObj'] += 1
    if cls not in prevDict['pos'][obj]:
        prevDict['pos'][obj][cls]    = {'coords': [], 'color': color}
        prevDict['edge'][obj][cls]   = []
        prevDict['locked'][obj][cls] = False
    return

def isPixelInBbox(x, y, sx, sy, ex, ey):
    if(x < sx or x >= ex) or (y < sy or y >= ey):
        return False
    else:
        return True

def init_mask_from_points(mask, points, sx=0, sy=0):
    '''
    points -- array in shape [N, 2] for (y, x)
    '''
    k = range(points.shape[0])
    mask[points[k, 0]-sy, points[k,1]-sx] = cv2.GC_FGD
    return mask

def refine_mask_grabcut(image, ini_mask, iterCount=5):
    bgdModel = np.zeros((1, 65), dtype=np.float64)
    fgdModel = np.zeros((1, 65), dtype=np.float64)
    mask, bgdModel,fgdModel = cv2.grabCut(image,
                                          ini_mask,
                                          None,
                                          bgdModel,
                                          fgdModel,
                                          iterCount,
                                          cv2.GC_INIT_WITH_MASK)
    #rect = (sx, sy, ex-sx, ey-sy)
    #cv2.grabCut(imgArr, mask, rect, bgdModel, fgdModel, iterCount, cv2.GC_INIT_WITH_RECT)

    outputMask = np.where((mask == 2)|(mask == 0), 0, 1).astype('uint8')

    return outputMask

def remove_points(mask, prevDict, obj, clsname, sx=0, sy=0, mode='remove_exist'):
    '''
    mask: current ann mask from latest annotation.
    obj/clsname: name of obj / class of the latest annotation.
    prevDict: existing annotation record.
    sx, sy: point location offset.
    '''
    for oname in prevDict['pos']:
        if oname is obj:
            continue
        for cname in prevDict['pos'][oname]:
            if cname is clsname:
                continue

            #remove
            clsPos = prevDict['pos'][oname][cname]
            for coord in clsPos['coords']:
                x = int(coord['x']-sx)
                y = int(coord['y']-sy)
                if(mask[y,x] != 0):
                    if mode is 'remove_exist':
                        clsPos['coords'].remove(coord)
                    else: # remove current mask
                        pass # work is done in construct label

    return mask


def construct_label(mask, prevDict, obj, clsname, sx=0, sy=0):
    # history result.
    pos = prevDict['pos']
    edge = prevDict['edge']
    locked = prevDict['locked']

    tmp_overlap = set()
    all_keys = list(pos.keys())
    for k, val in locked.items():
        for clsk, clsv in val.items():
            if clsv:
                for key in all_keys:
                    keysplit = key.split('__')[0]
                    # print(keysplit)
                    if k==keysplit and clsk in pos[key]:
                        for coord in pos[key][clsk]['coords']:
                            tmp_overlap.add((coord['x'], coord['y']))
                        for coord in edge[key][clsk]:
                            tmp_overlap.add((coord['x'], coord['y'])) # should not overlap the edge pixels too?


    objPos = pos[obj]
    objEdge = edge[obj]

    clsPos = objPos[clsname]
    clsEdge = objEdge[clsname]

    # latest result.
    struct = (3, 3)
    kernel = np.ones(struct)
    dilate = cv2.dilate(mask, kernel, iterations=1)
    edges  = mask ^ dilate
    edges_coords = np.nonzero(edges)
    coords = np.nonzero(mask)

    # merge them
    tmp = set()
    for coord in clsPos['coords']:
        tmp.add((coord['x'], coord['y']))

    tmp_edge = set()
    for coord in clsEdge:
        tmp_edge.add((coord['x'], coord['y']))

    for y, x in zip(list(coords[0]), list(coords[1])):
        x = int(sx + x)
        y = int(sy + y)
        if (x, y) in tmp_edge:
            tmp_edge.remove((x, y))

        if (x, y) not in tmp_overlap:
            tmp.add((x, y))

    for y, x in zip(list(edges_coords[0]), list(edges_coords[1])):
        x = int(sx + x)
        y = int(sy + y)
        # ignore the pixel with masks
        if (x, y) not in tmp and (x, y) not in tmp_overlap:
            tmp_edge.add((x, y))

    # update edge and positions
    clsPos['coords'] = []
    for item in tmp:
        clsPos['coords'].append({'x': item[0], 'y': item[1]})

    objEdge[clsname] = []
    for item in tmp_edge:
        objEdge[clsname].append({'x': item[0], 'y': item[1]})

    for key, clasdict in edge.items():
        for clsk, clsv in clasdict.items():
            if key==obj and clsk==clsname:
                continue

            keysplit = key.split('__')[0]
            if keysplit in locked.keys() and clsk in locked[keysplit] and locked[keysplit][clsk]:
                continue

            objPos = pos[key]
            objEdge = edge[key]

            clsPos = objPos[clsk]
            clsEdge = objEdge[clsk]

            # update edge and positions in case of overlap
            ntmp = set()
            updateFlag = False
            for coord in clsPos['coords']:
                c = (coord['x'], coord['y'])
                if c not in tmp and c not in tmp_edge:
                    ntmp.add(c)
                else:
                    updateFlag = True

            if updateFlag:
                clsPos['coords'] = []
                for item in ntmp:
                    clsPos['coords'].append({'x': item[0], 'y': item[1]})

            ntmp = set()
            updateFlag = False
            for coord in clsEdge:
                c = (coord['x'], coord['y'])
                if c not in tmp and c not in tmp_edge:
                    ntmp.add(c)
                else:
                    updateFlag = True

            if updateFlag:
                objEdge[clsk] = []
                for item in ntmp:
                    objEdge[clsk].append({'x': item[0], 'y': item[1]})


def construct_color_image(shape, color):
    try:
        r = color['r']
        g = color['g']
        b = color['b']
        blank = np.zeros(shape, dtype=np.uint8)
        blank[:,:,0] = r
        blank[:,:,1] = g
        blank[:,:,2] = b
        return blank
    except:
        traceback.print_exc()
        return None

def connectivity(inMask, seed_points, sx=0, sy=0):
    '''
    In inMask, only points connected with seed_points are kept
    @param: inMask -- array in shape [ht, wd]
            seed_points -- array in shape [N, 2], with points (py, px)
    '''
    seedI = np.zeros_like(inMask, dtype=np.float32)
    k = range(seed_points.shape[0])
    seedI[seed_points[k, 0], seed_points[k, 1]] = 1

    props = smeasure.regionprops(inMask, intensity_image=seedI)
    for prop in props:
        if prop.mean_intensity == 0:
            coord = prop.coords
            inMask[coord[:,0], coord[:,1]] = 0

    return inMask


def create_xml(data, root):
    for k, v in data.items():
        if k == 'c1':
            print('bug')
        # ALI xml element names shouldn't start with a number, so I added '_' to their names
        first_char = k[0]
        try:
            int(first_char)
            k = '_' + k
        except ValueError:
            pass

        if isinstance(v, dict):
            node = ET.SubElement(root, k)
            create_xml(v, node)
        elif isinstance(v, list):
            parent = ET.SubElement(root, k)
            if len(v) == 0:
                parent.text = str('[]')
            for idx, item in enumerate(v):
                if isinstance(item, dict):
                    node = ET.SubElement(parent, 'arr'+str(idx))
                    create_xml(item, node)
                else:
                    ET.SubElement(root, 'arr' + str(idx)).text = str(item)
        else:
            #print("{}: {}".format(k, v))
            ET.SubElement(root, k).text = str(v)


def server_pil_image(pil_img):
    img_io = io.BytesIO()
    pil_img.save(img_io, 'PNG')
    img_io.seek(0)
    base64img = base64.b64encode(img_io.getvalue())
    base64img = base64img.decode('utf-8')

    return base64img
