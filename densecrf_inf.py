import numpy as np

import pydensecrf.densecrf as dcrf
from pydensecrf.utils import create_pairwise_bilateral, unary_from_softmax

def denseCRF_refine(sm_probI, rgbI, n_labels=2):
    ht, wd = rgbI.shape[:2]
    d      = dcrf.DenseCRF(ht*wd, n_labels)

    sm_probI = sm_probI.reshape((-1))
    sm_probI = np.stack([1-sm_probI, sm_probI], axis=0)
    U        = unary_from_softmax(sm_probI)
    d.setUnaryEnergy(U)

    feats  = create_pairwise_bilateral(sdims=(17, 17), schan=(9, 9, 9), img=rgbI, chdim=2)
    d.addPairwiseEnergy(feats, compat=10, kernel=dcrf.DIAG_KERNEL, normalization=dcrf.NORMALIZE_SYMMETRIC)
    Q         = d.inference(5)
    fineLabel = np.argmax(Q, axis=0)
    return fineLabel.reshape([ht, wd])
