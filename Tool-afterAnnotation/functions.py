import numpy as np
import cv2
import xml.etree.ElementTree as ET


def rgb_key(r, g, b):
    return f'{r}-{g}-{b}'


def readin_class_rgb(fname):
    I = cv2.imread(fname)
    I = cv2.cvtColor(I, cv2.COLOR_BGR2RGB)
    return I


def readin_inst_gray(fname):
    I = cv2.imread(fname)

    return I[:, :, 0]


def readin_config_xml(fname):
    xml_file = ET.parse(fname)
    return parseXMLConfig(xml_file)


def parseXMLConfig(xml_file):
    '''
    return:
        a dict map color value into category_name
        a list of all annotated category names
    '''
    class_stk = xml_file.find('classStack')

    cls_dict, ann_cls_names = dict(), []
    for cls in class_stk:
        cls_name = cls.find('name').text
        cls_color = cls.find('color').text

        r, g, b = int(cls_color[:2], 16), int(cls_color[2:4], 16), int(cls_color[4:], 16)
        cls_color_key           = rgb_key(r, g, b)
        cls_dict[cls_color_key] = cls_name.lower()

        ann_cls_names.append(cls_name.lower())

    return cls_dict, ann_cls_names


def setup_output_config(categories):
    '''
    output a dictionary that map category to a index label
    '''

    if isinstance(categories, dict):
        out = {key.lower(): v for key, v in categories.items()}
    elif isinstance(categories, list):
        out = {key: k+1 for k, key in enumerate(sorted(categories))}
    else:
        print(f'Please input a valid category information')
        out = None
    return out


def combine_class_inst_xml(sem_rgbI, instI, xml_cfg, out_cfg):
    '''
    @Param: sem_rgbI (ndarray): in form of [h, w, 3], pixel in same category are in same color
            instI (ndarray): in form of [h, w], pixel belonging to same object are in same value
            xml_cfg (dict): map rgb_color value to 'category name'
            out_cfg (dict): map 'category name' to index label
    '''
    sem_rgbI = sem_rgbI.astype(float)
    semI = (sem_rgbI[:, :, 0] * 256 + sem_rgbI[:, :, 1]) * 256 + sem_rgbI[:, :, 2]

    color2cls = dict()
    for v in np.unique(semI):
        r, g, b = int(v)>>16, (int(v) >> 8) % 256, int(v) % 256
        key = rgb_key(r, g, b)

        if v == 0:
            color2cls[v] = 0
        elif key in xml_cfg and xml_cfg[key] in out_cfg:
            color2cls[v] = out_cfg[xml_cfg[key]]
        else:
            print(f'There exists miss matching value in class_rgb image, RGB are: {r}, {g}, {b}')
            color2cls[v] = 255

    import pdb; pdb.set_trace()
    semI = np.vectorize(color2cls.get)(semI)

    label2inst = dict()
    for k, v in enumerate(np.unique(instI)):
        label2inst[v] = k
    instI = np.vectorize(label2inst.get)(instI) # [h, w]

    return semI, instI





