
# Setup environment on your own machine.
    + Create a virtual environment (conda or virtualenv) with python3, and install the following libraries:
        - flask
        - waitress
        - PIL    # pillow.
        - easydict
        - scipy
        - scikit-image
        - matplotlib
        - tifffile
        - opencv-python # or install [openCV3](http://www.pyimagesearch.com/2016/10/24/ubuntu-16-04-how-to-install-opencv/)
        - tensorflow-gpu==1.12.0
        - cuda-9.0
        
    + download the network weights:
    ```
    >>> cd deeplab_interactive
    >>> mkdir -p sgis-itis/model
    >>> wget https://oregonstate.box.com/shared/static/b5cavab129bjvxbfmxajwzj8o5gfkij6.zip checkpoints.zip
    >>> unzip checkpoints.zip
    >>> mv checkpoints/* ./sgis-itis/model/
    >>> rmdir checkpoints
    >>> cd ../
    ```

    + You can also [download the model](https://oregonstate.box.com/s/qwgxpuyu9i1zelk0apntf4dttjdftjj1) with browser.
    
# run the annotator locally

    - config the model path in `config.py`.
    - start running of the app locally
        ```
        >>> python grabcut.py
        ```
        
# Deployment the tool yourself.
    - server devweb.fsl.orst.edu  
        + path: /export/www/strauss/image-annotator
    - server steed.eecs.oregonstate.edu
        + path: /scratch2/yuanjial/image-annotator
    - excute the GUI on the server:   
      1.update grabcut.py: app.run(debug=True) --> app.run(host='0.0.0.0', port=5000, debug=False)  
        ``` the model is running locally at: https:localhost:5000
        ```
      2.execute on in the background in one of below options:
        + via tmux or screen
        + nohup python grabcut.py >grabcut.log 2>grabcut.error &  
    

# Important files
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

