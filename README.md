## IDEAS-ImageAnnotator
[paper](https://spj.science.org/doi/10.34133/2022/9893639?permanently=true)
[link](https://ideas.eecs.oregonstate.edu/)
[![Watch the demo]()](https://www.youtube.com/watch?v=9Nu74INL5CA&feature=youtu.be)

# Multi-class/multi-object Image Segments Annotator
    + This is a web application for custom multi-class/multi-object annotation. Python Flask web framework was used to receive annotation request from frond-end. 
    + The front-end web page is implemented through HTML, Javascript, and jQuery, the front-end supported functions include:
        - customized class/object definition
        - toolkit to specify user interactive tool (pen, rectangle, back-end algorithm selection)
        - history panel to undo unwanted operation, etc.
        - canvas for user to interact with the back-end service.
        - image gallary and file I/O support.

    + On the back-end, Python Flask web framework was used to receive annotation request from front-end, and implemented image processing functions include:
        - Deep Object selection algorithm, that generate initial object mask from pos/neg strokes under Tensorflow 1.12.0
        - GrabCut to refine object mask based on RGB color and the DL object mask
        - Generated mask mush connect to the given positive strokes.
        - Lock/unlock the previous annotated objects so new generated mask have the first/lowest priority.
        - manual mode that what the user draws are what the final object mask get.

### Developers (time ordered):
    - Zheng Zhou
    - Ali Behnoudfar
    - Nihar Ashesh Doshi
    - Damanpreet Kaur
    - Nicholas Kiddle
    - Jialin Yuan
    - Fuxin Li
    
    - co-workers (time ordered):
        + Pierce, Brett Richard
        + Mewalal, Ritesh
        + Peremyslova, Ekaterina
        + Nagle, Michael F
        + Strauss, Steven

### Installation
    + Create a virtual environment (conda or virtualenv) with python3, and install the following libraries:
        - flask
        - waitress
        - PIL    # pillow.
        - openCV for python # install [openCV3](http://www.pyimagesearch.com/2016/10/24/ubuntu-16-04-how-to-install-opencv/) or install *opencv-python* using 'pip install opencv-python'
        - tensorflow-gpu==1.12.0
        - cuda-9.0
        - easydict
        - scipy
        - scikit-image
        - matplotlib
        - tifffile
    + download the network weights:
    ```
    >>> cd deeplab_interactive
    >>> mkdir -p sgis-itis/model
    >>> wget https://oregonstate.box.com/shared/static/b5cavab129bjvxbfmxajwzj8o5gfkij6.zip checkpoints.zip
    >>> unzip checkpoints.zip
    >>> mv checkpoints/* ./
    >>> rmdir checkpoints
    >>> cd ../../
    ```

### Annotation demo
    - How to do annotation: [Demo](https://www.youtube.com/watch?v=XsA-FZ-k-UI)

### Deployment
    - server devweb.fsl.orst.edu  
        + path: /export/www/strauss/image-annotator
    - server steed.eecs.oregonstate.edu
        + path: /scratch2/yuanjial/image-annotator
    - excute the GUI on the server:   
      1.update grabcut.py: app.run(debug=True) --> app.run(host='0.0.0.0', port=5000, debug=False)  
      2.execute on in the background in one of below options:
        + via tmux or screen
        + nohup python grabcut.py >grabcut.log 2>grabcut.error &  
    

### Important files
    - templates/generic.html, the pre-defined template for the user interface. Besides this, in order to add components into the user interface, developer should find the id or class of the parent wrapper and add the components by using jQuery.  There are a lot of functions for appending components. More details can be found on the official documentation of jQuery.
    - statics/js/imgloader.js, front-end file, this file contains the ``` ImgLoader ``` class loads the image file into canvas when user drops images. ``` $ele ``` handles all events happened in the drop box.
    - statics/js/annotator.js, front-end file, for functions related to the GUI page. It defines the data-structure and functions for GUI.
        + the tree view of naming system is implemented via [jqtree](http://mbraak.github.io/jqTree/)
        + [FileSaver](https://github.com/eligrey/FileSaver.js/) is used for saving files on client-side.
        + major data structures:
            * InfoStack: InfoStack works as normal stack which is first in last out. Two types of InfoStack serve two different purpose. Type 'class' is simply a normal stack with pre-defined maximum number. Type 'history' moves the current index back by one unit instead of remove the element when undo happened. This is in order to keep the contains for redo. The functions in InfoStack data structure are self-explained.
            * AnnoClass: AnnoClass abstractly represents the class in class panel. The instance of this data structure will be stored into InfoStack. ``` uid ``` member variable is the unique ID of the class. ``` parent ``` member variable is the parent class. ``` subClasses ``` member variable stores all children classes. ``` color ``` member variable defines the color of class. ``` name ``` member variable defines the name of class.
            * Label: Label abstract data structure depicts the label that responds from server-side by positions of pixels. It stores the color information in the ``` pos ``` member variable as well to show the label on canvas.


    - grabcut.py, the major back-end file, it receives front-end request and return back-end result.
    - DLearning\_PosNeg\_select.py, back-end file, it implements the [Deep Object Selection algorithm](https://arxiv.org/pdf/1603.04042.pdf)
        + deep\_interactive/*, back-end files, tensorflow implementation of the Deep Neural Network
    - api/data\_manipulation.py, back-end file, it manages to decide what kind of object masks are effective.
    - config.py, back-end file, image processing related configurations.
