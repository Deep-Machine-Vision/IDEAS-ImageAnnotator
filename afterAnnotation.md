# Annotation result including.
1. save out the 'class in rgb' result, and file name is '[FILENAME]\_class.png' 
2. save out the 'object class in gray' result, and file name is '[FILENAME]\_inst\_class\_gray.png'
3. a config file including customized class names and their colors in save out '[FILENAME]\_class.png'


# save annotation result in below architecture
```
-- annotations
  -- file_1_class.png
  -- file_1_inst_class_gray.png
  -- file_2_class.png
  -- file_2_inst_class_gray.png
  -- ...

-- config.xml

```

Or, 

```
-- annotations
  -- sequence_1
    -- file_1_class.png
    -- file_1_inst_class_gray.png
    -- file_2_class.png
    -- file_2_inst_class_gray.png
    -- ...
  
  -- sequence_1
    -- file_1_class.png
    -- file_1_inst_class_gray.png
    -- file_2_class.png
    -- file_2_inst_class_gray.png
    -- ...

  -- sequence_ ...

-- config.xml
```

# Parse annotation result into instance label image and semantic label image.
+ dependencies:
    ```
    numpy
    opencv-python
    scipy
    fonts
    font-fredoka-one 
    ```

+ demo of parsing:
    ```
    >>> cd Tool-afterAnnotation
    >>> python demo_parse.py
    ```

+ customize your own parsing process:
    1. refering to the `Tool-afterAnnotation/demo_parse.py`.
    2. setup below variable in line 6~11:
    ```
    xml_config_fpath
    in_annotated_path
    categories
    save_path
    ```


