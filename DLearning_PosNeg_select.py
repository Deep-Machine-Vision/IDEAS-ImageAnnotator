'''
#  created on Nov 20th, 2017
#  The whole process is to generate object mask given the rgb image, postive points inside the object, and negative points outside the object.
#               #mask = DLearning_PosNeg(posPoint, Negpoints, rgbImg, previousMask)
#  Work for the Plant Annotator UI.
'''
import os
import numpy as np
import cv2
from scipy import ndimage
from scipy.stats import norm
import tensorflow as tf
from config import cfg
from deep_interactive import DeepLabResNetModel
from network.deeplab import common, model
#from densecrf_inf import DLearning_PosNeg
from network.Layer import Layer

IMG_MEAN = np.array((104.00698793,116.66876762,122.67891434, 156.042324, 156.523433), dtype=np.float32)
INPUT_TENSOR_NAME = 'ImageTensor:0'
OUTPUT_TENSOR_NAME = 'SemanticProbabilities:0'

def _generate_distTrans_channel(imShape, pts, scale=4):
    mask = np.ones(imShape)
    k    = range(pts.shape[0])
    mask[pts[k, 0], pts[k,1]] = 0

    energy = ndimage.morphology.distance_transform_edt(mask)
    energy = energy * scale
    energy[energy > 255] = 255

    return np.uint8(energy[..., np.newaxis])

def normalise(dt):
  dt = dt.astype(np.float32)
  dt[dt > 20] = 20
  dt = norm.pdf(dt, loc=0, scale=10) * 25 # gaussian norm
  return dt

def _get_distance_transform(pts, label):
  dt = np.ones_like(label)
  if len(pts) > 0:
    for y, x in pts:
      dt[y, x] = 0
    dt = ndimage.morphology.distance_transform_edt(dt)
  else:
    dt *= 255

  dt = normalise(dt)
  return dt[..., np.newaxis].astype(np.float32)


def _extend_bboxes(boxes, ht, wd, scale=0.2, minbox=[64, 96]):
    '''
    @func: adjust the crop box, make sure it has certain size.
    @param: boxes -- [x0, y0, x1, y1]
    @output: box -- [x0, y0, x1, y1]
    '''
    x0,y0,x1,y1 = boxes
    cy, cx = (y0+y1)//2, (x0+x1)//2
    bht = max((y1 - y0)*(1+scale), minbox[0])
    bwd = max((x1 - x0)*(1+scale), minbox[1])

    # keep image ht-wd ratio
    pht = int(max(bht, bwd*ht/float(wd)))
    pwd = int(max(bwd, bht*wd/float(ht)))

    ext_x0 = max(cx - pwd//2, 0)
    ext_x1 = min(ext_x0+pwd, wd)
    ext_y0 = max(cy - pht//2, 0)
    ext_y1 = min(ext_y0+pht, ht)

    return [ext_x0, ext_y0, ext_x1, ext_y1]


def _construct_bbox_from_negPts(pts, imHt, imWd):
    if len(pts) < 3 or cfg.crop_by_neg_pts==False:
        box = [0, 0, imWd, imHt]
    else:
        # box in [x0, y0, x1, y1]
        box = [pts[:,1].min(), pts[:, 0].min(), pts[:,1].max(), pts[:,0].max()]
        box = _extend_bboxes(box, imHt, imWd, scale=0.2, minbox=[32, 32])

    return box

def _construct_input(rgbImg, segInput, posPts, negPts):
    mask = np.ones(rgbImg.shape[:2])
    segInput = np.expand_dims(segInput*255, axis=2)
    pos_energy = _get_distance_transform(posPts, mask) * 255
    neg_energy = _get_distance_transform(negPts, mask) * 255
    return np.concatenate((rgbImg, neg_energy, pos_energy, segInput), axis=2)

def Setup_environment_optimized():
    graph = tf.Graph()
    graph_def = tf.GraphDef()
    with open('./deep_interactive/graph_quantized.pb', 'rb') as f:
        graph_def.ParseFromString(f.read())
    with graph.as_default():
        tf.import_graph_def(graph_def)

    inOps = graph.get_operation_by_name("import/input_image")
    outOps = graph.get_operation_by_name("import/ResizeBilinear")
    sess = tf.Session(graph=graph)

    return sess, inOps.outputs[0], outOps.outputs[0]

def Setup_environment():
    # create network
    os.environ['CUDA_VISIBLE_DEVICES'] = cfg.DL_gpu_id
    inImg = tf.placeholder(tf.float32, shape=[None, None, 5], name = 'input_image')
    net = DeepLabResNetModel({'data':tf.expand_dims(inImg, axis=0)}, trainable=False, is_training=False)

    raw_output = net.layers['fc1_voc12']
    probI = tf.nn.sigmoid(tf.image.resize_bilinear(raw_output, tf.shape(inImg)[0:2,]))

    # set up tf session and initialize variables
    config = tf.ConfigProto()
    config.gpu_options.allow_growth = True
    config.gpu_options.per_process_gpu_memory_fraction=0.9
    config.allow_soft_placement = True
    sess = tf.Session(config=config)
    sess.run(tf.global_variables_initializer())

    # load variables
    restore_var = tf.global_variables()
    loader = tf.train.Saver(var_list=restore_var)
    loader.restore(sess, cfg.PosNeg_Model_weight_Path)

    return sess, inImg, probI

def Setup_environment_seg():
    # create network
    os.environ['CUDA_VISIBLE_DEVICES'] = cfg.DL_gpu_id

    model_options = common.ModelOptions(
      outputs_to_num_classes={"features": 2},
      crop_size=None,
      atrous_rates=[6, 12, 18],
      output_stride=16,
      merge_method="max",
      add_image_level_feature=True,
      aspp_with_batch_norm=True,
      aspp_with_separable_conv=True,
      multi_grid=None,
      decoder_output_stride=4,
      decoder_use_separable_conv=True,
      logits_kernel_size=1,
      model_variant="xception_65")

    inImg = tf.placeholder(tf.uint8, [None, None, 6], name='input_image')
    
    outputs_to_scales_to_logits = model.multi_scale_logits(tf.expand_dims(inImg, axis=0),
                                                           model_options=model_options,
                                                           image_pyramid=None,
                                                           weight_decay=Layer.L2_DEFAULT,
                                                           is_training=False,
                                                           fine_tune_batch_norm=False)

    logits = outputs_to_scales_to_logits["features"]["merged_logits"]
    logits = tf.image.resize_images(logits, tf.shape(inImg)[0:2,])
    probI = tf.nn.softmax(logits, -1, 'softmax')

    # set up tf session and initialize variables
    config = tf.ConfigProto()
    config.gpu_options.allow_growth = True
    config.gpu_options.per_process_gpu_memory_fraction=0.9
    config.allow_soft_placement = True
    sess = tf.Session(config=config)
    sess.run(tf.global_variables_initializer())

    # load variables
    restore_var = tf.global_variables()
    loader = tf.train.Saver(var_list=restore_var)
    loader.restore(sess, cfg.PosNeg_Model_weight_Path)

    return sess, inImg, probI

def Setup_environment_seg_optimized():
    graph = tf.Graph()
    graph_def = tf.GraphDef()
    with open('inference_graph.pb', 'rb') as f:
        graph_def.ParseFromString(f.read())
    with graph.as_default():
        tf.import_graph_def(graph_def)

    if graph_def is None:
        raise RuntimeError('Cannot find inference graph in tar archive.')

    with graph.as_default():
        tf.import_graph_def(graph_def, name='')

    sess = tf.Session(graph=graph)
    return sess

def _resize_input(inData, ori_size, min_size=65, max_size=513):
    '''
    resize inData (ht, wd, 5) to size within (min_size, max_size)
    '''
    ht, wd = ori_size
    maxV = max(ht, wd)
    minV = min(ht, wd)
    if minV < min_size:
        scale = min_size/float(minV)
    elif maxV > max_size:
        scale = max_size/float(maxV)
    else:
        scale = None

    if scale is not None:
        inData = ndimage.zoom(inData, (scale, scale, 1), order=1, prefilter=False)
    return inData


def DLearning_PosNeg(sess, segInput, netInput, netOutput, pos_pts, neg_pts, rgbImg, negBbox = False):
    # input convert into local window
    ht, wd = rgbImg.shape[:2]
    if negBbox:
        bbox = _construct_bbox_from_negPts(neg_pts, ht, wd)
        zm_rgbImg = rgbImg[bbox[1]:bbox[3], bbox[0]:bbox[2], :]
        ht, wd = zm_rgbImg.shape[:2]
    else:
        bbox = [0, 0, wd, ht]
        zm_rgbImg = rgbImg

    # construct 6 channel input
    cropData = _construct_input(zm_rgbImg, segInput, pos_pts, neg_pts)

    # resize input to limit size in DL and resize back
    rsData   = _resize_input(cropData, [ht, wd], cfg.DL_min_img_size, cfg.DL_max_img_size)
    if cfg.DBG_PRT:
        print('      : -- DL image size, original | rectangle | DL ',
                        rgbImg.shape, ' | ', cropData.shape, ' | ', rsData.shape)

    probI = sess.run(netOutput,
                     feed_dict={netInput: np.float32(rsData)})[0][:,:,1]
    
    probI = cv2.resize(probI.squeeze(), (wd, ht))

    # construct labelI for grabCut
    labelI   = np.zeros([ht, wd])+ cv2.GC_BGD
    labelI[probI > 5e-2]  = cv2.GC_PR_BGD
    labelI[probI >= 0.9] = cv2.GC_PR_FGD

    k    = range(pos_pts.shape[0])
    labelI[pos_pts[k, 0], pos_pts[k,1]] = cv2.GC_FGD
    k    = range(neg_pts.shape[0])
    labelI[neg_pts[k, 0], neg_pts[k,1]] = cv2.GC_BGD
    
    return bbox, labelI
