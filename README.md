## IDEAS-ImageAnnotator
[![Watch the demo](https://i.ytimg.com/vi/9Nu74INL5CA/hqdefault.jpg)](https://www.youtube.com/watch?v=9Nu74INL5CA&feature=youtu.be)

+ [paper @ PlantPhenomics 2022](https://spj.science.org/doi/10.34133/2022/9893639?permanently=true)

+ [Go to the IA](https://ideas.eecs.oregonstate.edu/)


+ [Run the tool on your local machine or server](runLocally.md)

+ [Guidance for saving and parsing annotation result](afterAnnotation.md)

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

# Contributors (time ordered):
- Zheng Zhou
- Ali Behnoudfar
- Nihar Ashesh Doshi
- Damanpreet Kaur
- Nicholas Kiddle
- [Jialin Yuan](https://jia2lin3yuan1.github.io/)
- [Fuxin Li](https://web.engr.oregonstate.edu/~lif/)

- co-workers (time ordered):
    + Pierce, Brett Richard
    + Mewalal, Ritesh
    + Peremyslova, Ekaterina
    + [Nagle, Michael F](https://directory.forestry.oregonstate.edu/people/nagle-michael)
    + [Strauss, Steven](https://directory.forestry.oregonstate.edu/people/strauss-steven)
