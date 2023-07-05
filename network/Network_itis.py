import tensorflow as tf

from core.Log import log
from network.NetworkTower import NetworkTower, TowerSetup


class Network:
  def __init__(self,  dataset, is_trainnet, freeze_batchnorm, name, reuse_variables=None):
    self.name = name
    self.input_tensors_dict = dataset.create_input_tensors_dict(self.batch_size)
    self._towers = self._build_towers(dataset, is_trainnet, freeze_batchnorm, reuse_variables)
    #self.tower_total_losses_with_regularizers = [t.total_loss_with_regularizer for t in self._towers]
    self.tower_setups = [t.setup for t in self._towers]
    self.tower_measures = [t.measures for t in self._towers]
    self.tower_extractions = [t.extractions for t in self._towers]

    # for now put the extractions from the dataset into the first tower.
    for k in self.input_tensors_dict:
      assert k not in self.tower_extractions[0]
    self.tower_extractions[0].update(self.input_tensors_dict)

  def _build_towers(self, dataset, is_trainnet, freeze_batchnorm, reuse_variables):
    towers = []
    with tf.name_scope(self.name):
      input_tensors_dict_sliced = self.input_tensors_dict        

      tower_setup = TowerSetup(gpu_idx=0, reuse_variables=False, dataset=dataset,
                                 variable_device="/gpu:0", is_training=is_trainnet,
                                 is_main_train_tower=is_trainnet and gpu_idx == 0, freeze_batchnorm=freeze_batchnorm,
                                 network_name=self.name)
      tower = NetworkTower(tower_setup, input_tensors_dict_sliced, dataset)
      towers.append(tower)
    return towers
