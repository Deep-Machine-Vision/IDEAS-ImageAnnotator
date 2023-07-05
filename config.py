

from easydict import EasyDict as edict

__C = edict()
cfg = __C

# print debug info
__C.MONITOR_TIME = 1
__C.DBG_PRT = 0

# web UI parameters:
__C.DL_obj_sel_en = 1 
__C.DL_gpu_id = '1'
__C.DL_max_img_size = 513
__C.DL_min_img_size = 129

# Grabcut algorithm parameters
__C.GC_iter_count = 2

# Object Selction model parameters
__C.PosNeg_Model_weight_Path = './deep_interactive/sgis-itis/model/pascal_itis-00000070'
__C.PosNeg_distTrans_scale  = 4
__C.crop_by_neg_pts = False




