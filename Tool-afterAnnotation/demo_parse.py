import os
from save_tool import SaveTool
from functions import *


xml_config_fpath = 'data/robot-annotation.xml'
in_annotated_path = 'data'


categories = ['object', 'robot', 'shelf', 'table']
save_path = 'annotation'

sem_postfix = '_class.png'
inst_postfix = '_inst_class_gray.png'


# prepare savetool
save_tool = SaveTool()

# prepare config dict
out_cfg               = setup_output_config(categories)
xml_cfg, xml_clsnames = readin_config_xml(xml_config_fpath)

assert all([ele in out_cfg for ele in xml_clsnames])
print(f'#  Categories in XML file: {xml_clsnames}')
print(f'   Catetories in given categories: {out_cfg}')

# get the image list to be processed.
file_list = os.listdir(in_annotated_path)
if '.png' not in file_list[0]:
    # support for list of sequence
    image_list = []
    for seq in file_list:
        seq_path = os.path.join(in_annotated_path, seq)
        tmp = [f'{seq_path}/{seq}/{fname}' for fname in os.listdir(seq_path) if sem_postfix in fname]
        image_list.extend(tmp)
else:
    image_list = [f'{in_annotated_path}/{fname}' for fname in file_list if sem_postfix in fname]

# parsing of the annotation on each image
for fname in image_list:
    sem_rgbI = readin_class_rgb(fname)
    instI    = readin_inst_gray(fname.replace(sem_postfix, inst_postfix))

    semI, instI = combine_class_inst_xml(sem_rgbI, instI, xml_cfg, out_cfg)

    out_sem_path = os.path.join(save_path, fname.replace(sem_postfix, '_sem.png'))
    if not os.path.exists(os.path.dirname(out_sem_path)):
        os.makedirs(os.path.dirname(out_sem_path), exist_ok=True)
    save_tool.save_single_pilImage_gray(semI,
                                        palette='label',
                                        save_path= out_sem_path)

    out_inst_path = os.path.join(save_path, fname.replace(sem_postfix, '_inst.png'))
    if not os.path.exists(os.path.dirname(out_inst_path)):
        os.makedirs(os.path.dirname(out_inst_path), exist_ok=True)
    save_tool.save_single_pilImage_gray(instI,
                                        palette='label',
                                        save_path= out_inst_path)





