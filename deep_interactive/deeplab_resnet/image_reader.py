import numpy as np
from tifffile import imread as tiff_imread
import cv2
import scipy.misc as misc
import pdb
''' Class BatchDataset used to read data batch by batch. the output is a ndarray with
(batch_size, ht, wd, ch)

-- data_dir: path to the directory with images and labels
-- data_txt: path to the file with lines of form '/path/to/image /path/to/label'.
-- image_options: a dictionary of options for modifying the output.
                  Like {'resize': True, 'resize_size':[ht, wd], 'random':False}

-- image_list / label_list: list of full path  where data are.
-- image_num: size of dataset.

-- batch_perm: used for SGD, flush input order.
-- batch_offset: indicate where the batch goes.
'''

ONLY_POS = False
IMG_MEAN = np.array((104.00698793,116.66876762,122.67891434, 100.0, 100.0), dtype=np.float32)
class BatchDataset:
    data_dir = []
    data_txt = []
    image_options = {}

    image_list = []
    pnmap_list = []
    label_list = []
    image_num  = 0

    batch_perm   = []
    batch_offset = 0

    def __init__(self, data_dir, data_txt, image_options={}):
        print("Initializing Batch Dataset Reader...")
        print(image_options)
        self.data_dir = data_dir
        self.data_txt = data_txt
        self.image_options = image_options

        self.parse_data_list()
        self.image_num = len(self.image_list)
        self.batch_perm = np.arange(self.image_num)

    def parse_data_list(self):
        f = open(self.data_txt,'r')
        for line in f:
            try:
                image, pnmap, label = line.strip("\n").split(' ')
            except ValueError:
                image = pnmap = label = line.strip("\n")
            self.image_list.append(self.data_dir + image)
            self.pnmap_list.append(self.data_dir + pnmap)
            self.label_list.append(self.data_dir + label)

    def read_batch_images_from_disk(self, file_list, flipH=False):

        images = np.array([self.transform(self.image_list[k], flipH, 'rgb') for k in file_list])
        pnmaps = np.array([self.transform(self.pnmap_list[k], flipH, 'tiff') for k in file_list])
        labels = np.array([self.transform(self.label_list[k], flipH, 'grey') for k in file_list])

        pnmaps = pnmaps[..., 0] if ONLY_POS else pnmaps
        images = np.concatenate((images, pnmaps[..., np.newaxis]), axis=3) if ONLY_POS else np.concatenate((images, pnmaps), axis=3)
        images = np.float32(images) - IMG_MEAN[:4] if ONLY_POS else np.float32(images) - IMG_MEAN
        labels = labels[..., np.newaxis]
        labels[labels>0] = 1
        return images, labels


    # read data, and if necessary, do resize and flipH
    def transform(self, file_name, flipH=False, file_type=None):
        if file_type=='tiff':
            image = tiff_imread(file_name)
            image = np.transpose(image, [1, 2, 0])
        elif file_type == 'grey':
            image = misc.imread(file_name, mode='P')
        else:
            image = cv2.imread(file_name)

        # resize if needed
        if self.image_options.get("resize", False) and self.image_options["resize_size"]:
            ht, wd = self.image_options["resize_size"]

            interp = cv2.INTER_LINEAR if len(image.shape) > 2 else cv2.INTER_NEAREST
            resized_image = cv2.resize(image, (ht, wd), interpolation=interp)
        else:
            resized_image = image

        # do Horizontal flip for data augmentation
        if flipH:
            flip_image = np.fliplr(resized_image)
        else:
            flip_image = resized_image

        return np.asarray(flip_image)


    # return data of one batch.
    def next_batch(self, batch_size, random = False):
        if self.batch_offset + batch_size > self.image_num:
            self.batch_offset = 0

            if random:
                np.random.shuffle(self.batch_perm)

        # fetch one batch of data
        start     = self.batch_offset
        self.batch_offset += batch_size
        file_list = self.batch_perm[start:self.batch_offset]
        images, labels = self.read_batch_images_from_disk(file_list)

        return images, labels






