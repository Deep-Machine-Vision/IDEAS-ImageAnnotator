(function($){
  'use strict';

  function Point(x, y){
    this.x = x;
    this.y = y;
  }

  function RedoItem(action, points){
    this.action = action;
    this.points = points;
  }

  function ClassInfo(name, color){
    this.name = name;
    this.color = color;
  }

  /**
     * Function to construct annotator
     * @param {int} type       [Type for using this stack]
     * @param {int} limit      [The maximum number of element for the stack]
  */

  function infoStack(type, limit=200){
    this.curIdx = null;
    this.size = null;
    this.data = [];
    this.limit = limit;
    this.hadUndo = null;
    this.type = type;
    this.init();
  }

  infoStack.prototype = {
    init: function(){
      var self = this;
      self.curIdx = 0;
      self.size = 0;
      self.hadUndo = false;
    },
    getSize: function(){
      var self = this;
      return self.size;
    },
    add: function(item){
      var self = this;
      var flag = self.checkLimit();
      switch(flag){
        case 0:
          // failed to add
          return 0;
        case 1:
          // overflow, remove oldest and add new item
          for (var i = 0; i < self.limit-1; i++){
            self.data[i] = self.data[i+1];
          }
          self.data[self.size-1] = item;
          return 1;
        case 2:
          // add new item
          self.data[self.curIdx] = item;
          self.curIdx = self.curIdx + 1;
          self.size = self.size + 1;
          return 2;
      }
    },

    peek: function(){
      var self = this;
      return self.data[self.curIdx-1];
    },
    find(idx){
      var self = this;
      return self.data[idx];
    },

    checkLimit: function(){
      var self = this;
      if (self.type == 0 && self.size >= self.limit){
        return 0;
      }else if (self.type == 1 && self.size >= self.limit){
        return 1;
      }
      return 2;
    },

    seekLatestByKey: function(key, val){
      var self = this;
      for (var i = this.size-1; i >=0; i--){
        if (self.data[i][key] === val){
          return self.data[i];
        }
      }
      return null;
    },

    delete: function(idx){
      var self = this;
      if (self.size == 0){
        return false;
      }
      for (var i = idx; i < this.size-1; i++){
        self.data[i] = self.data[i+1];
      }
      self.size = self.size - 1;
      self.curIdx = self.curIdx - 1;
      return true;
    },

    checkDup: function(item){
      var self = this;

      for (var i = 0; i < self.size; i++){
        for (var key in self.data[i]){
          if (self.data[i][key] === item[key]){
            return true;
          }
        }
      }
      return false;
    },

  }

  function State(history, hierarchy, canvasData, imageData){
    this.history = history;
    this.hierarchy = hierarchy;
    this.canvasData = canvasData;
    this.imageData = imageData

  }

  /**
    * annoclass object definition
    * @param {Array}  subClasses    [An array of child classes for the class]
    * @param {int}    level         [Depth of the class]
    * @param {string} color         [Color of the class]
    * @param {string} name          [class name]
    * @param {bool}   selected      [If class is selected or not]
  */

  function AnnoClass(uid, parent, subClasses, color, name){
    this.uid = uid;
    this.parent = parent;
    this.subClasses = subClasses;
    this.color = color;
    this.name = name;
  }

  function Label(){
    this.numObj = 0;
    this.pos = {};
    this.edge = {};
    this.locked = {}; //holds the status of locked items.
  }

  /**
     * Function to construct annotator
     * @param {DOM} wrapperCanvas         [Canvas wrapping div]
     * @param {string} imgURL             [image URL for rendering to canvas]
     * @param {object} wrapperCanvasCtx   [Canvas Context]
     * @param {array} images              [File objects]
  */

  function Annotator(wrapperCanvas, pointCanvas, maskCanvas, semCanvas, imgURL, wrapperCanvasCtx, pointCtx, maskCtx, semCtx, images){
      this.canvas = wrapperCanvas;
      this.canvasP = pointCanvas;
      this.canvasSem = semCanvas;
      // canvas that has no scale
      this.nonscaledCanvas = null;
      this.nonscaledCtx = null;
      // sem canvas that has no scale
      this.nonscaledCanvasSem = null;
      this.nonscaledCtxSem =  null;
      // //mask canvas that has no scale
      this.nonscaledCanvasM = null;
      this.nonscaledCtxM = null;
      this.picData = imgURL;
      // current scale
      this.scaleCanvas = 1;
      this.scaleLabel = 1;
      // the click times of zooming buttons for canvas and label
      this.clicksCanvas = 0;
      this.clicksLabel = 0;
      // processed images
      this.imageProcessed = null;
      // raw images
      this.images = images;
      // converted images URL
      this.imagesURL = null;
      this.canvasData = null;
      this.canvasDataSem = null;
      this.stackType = null;
      this.ctx = wrapperCanvasCtx;
      this.ctxP = pointCtx;
      this.ctxM = maskCtx;
      this.ctxSem = semCtx;
      this.width = wrapperCanvasCtx.canvas.width;
      this.height = wrapperCanvasCtx.canvas.height;
      this.imageData = wrapperCanvasCtx.getImageData(0, 0, wrapperCanvasCtx.canvas.width, wrapperCanvasCtx.canvas.height);
      this.maskCanvasData = maskCtx.getImageData(0, 0, maskCtx.canvas.width, maskCtx.canvas.height);
      this.semCanvasData = semCtx.getImageData(0, 0, semCtx.canvas.width, semCtx.canvas.height);
      // 'class in rgb' | 'object in rgb' | 'object-class in rgb' | 'object-class in gray'
      this.maskType = 'class in rgb';
      this.curImgID = 0;
      // Array with State object.
      this.states = null;
      // recording stacks
      this.classStack = null;
      this.classUid = 0;
      this.selectedClass = null;
      //{'image': canvasData, 'tool': string, 'labelFinal': labelData, 'labelWorking': labelData, 'overlap': visualization, 'hie': hierarchy}
      this.historyStack = null;
      this.historyRedoStack = null;
      // {'name': string, 'id': id, 'classes': {'name': string, 'color': string, 'uid', int, 'node': classnode}, 'node': node, 'object': object label}
      this.hierarchyStack = null;
      this.hieUid = null;
      this.selectedHie  = null;
      //whether the class has been changed or not
      this.classChange = false;
      // ready to send polygon mask or not
      this.sendPoly = null;
      // current zoom factor
      this.curZoomFactor = 1;
      // jQuery element for globally using
      this.$classPanelWrapper = null;
      this.$hisPanelWrapper = null;
      this.$toolKitWrapper = null;
      this.$hierarchyWrapper = null;
      this.$optionsWrapper = null;
      this.$editorWrapper = null;
      this.$selectHieFrame = null;
      self.$selectClassFrame = null;
      this.$hieOptions = null;
      self.$historyFrame = null;
      self.$galleryMain = null;
      // {'name': , 'color': }
      // current tool
      this.curTool = null;
      // current Mode
      this.curMode = null;
      // meta data for recording the masked pixels
      this.metaData = null;
      // check if mouse pressed for drawing lines
      this.mousePressed = null;
      // record the point before mouse action
      this.point = null;
      // record the bounding box if any
      this.bbox = null;
      // all polygon points
      this.polygonPoints = null;
      // check if start a polygon draw
      this.polyStarted = null;
      //positive point markers
      this.posPoints = null;
      //negative point markers
      this.negPoints = null;
      //stores checked classes
      this.checkedClasses = null;
      //action history
      this.actionHis = null;
      //redo history
      this.redoHis = null;
      // line width for pen
      this.lineWidth = null;
      // thumbnails' size
      this.thumbWidth = null;
      this.thumbHeight = null;
      this.init();

  }

  Annotator.prototype = {
    init: function(){
      var self = this;
      self.maxsize_historyStack = 50;
      self.maxsize_classStack     = 100;
      self.maxsize_hierarchyStack = 200;

      // initialize state;
      self.mousePressed = false;
      self.polyStarted = false;
      self.point = new Point(0, 0);
      self.polygonPoints = new Array();
      self.posPoints = new Array();
      self.negPoints = new Array();
      self.checkedClasses = new Array();
      self.states = new Array();
      self.sendPoly = false;
      self.hieUid = 0;
      self.lineWidth = 0;
      // type of usage of stack.
      self.stackType ={'class': 0, 'history': 1};

      self.canvasData = self.canvas[0].toDataURL();
      self.canvasDataSem = self.canvasSem[0].toDataURL();

      // initialize bounding box
      self.bbox = {
          bboxData: null,
          isBox: false,
          start_x: 0,
          start_y: 0,
          end_x: self.width,
          end_y: self.height,
      };

      self.labelFinal = new Label();
      self.labelWorking = new Label();

      // working canvas and context, not for visualizing with scale.
      self.nonscaledCanvas = $("<canvas>").attr("width", self.width).attr("height", self.height)[0];
      self.nonscaledCtx = self.nonscaledCanvas.getContext("2d");
      self.nonscaledCtx.putImageData(self.imageData, 0, 0);
      self.nonscaledCanvasSem = $("<canvas>").attr("width", self.width).attr("height", self.height)[0];
      self.nonscaledCtxSem = self.nonscaledCanvasSem.getContext("2d");
      self.nonscaledCtxSem.putImageData(self.semCanvasData, 0, 0);
      self.nonscaledCanvasM = $("<canvas>").attr("width", self.width).attr("height", self.height)[0];
      self.nonscaledCtxM = self.nonscaledCanvasM.getContext("2d");
      self.nonscaledCtxM.putImageData(self.maskCanvasData, 0, 0);
      self.classStack = new infoStack(self.stackType['class'], self.maxsize_classStack);
      self.hierarchyStack = new infoStack(self.stackType['class'], self.maxsize_hierarchyStack);
      self.historyStack = new infoStack(self.stackType['history'], self.maxsize_historyStack);
      self.historyStack.add({tool:'null'});
      self.historyRedoStack = new infoStack(self.stackType['history'], self.maxsize_historyStack);

      //radius of click around the first point to close the draw of polygon
      self.POLY_END_CLICK_RADIUS = 10;
      //the max number of points of your polygon
      self.POLY_MAX_POINTS = 8;
      //the max number of points of positive
      self.POS_MAX_POINTS = 1000;
      //the max number of points of negative
      self.NEG_MAX_POINTS = 1000;
      self.$optionsWrapper = $('<div class="optionswrapper panelwrapper "></div>');
      self.$classPanelWrapper = $('<div id="class-tab" class="optionsele panelwrapper"></div>');
      self.$hisPanelWrapper = $('<div class="panelwrapper"></div>');
      self.$toolKitWrapper = $('<div class="toolwrapper"></div>');
      self.$hierarchyWrapper = $('<div id="hierarchy-tab" class="optionsele hierarchywrapper"></div>');
      self.$editorWrapper = $('<div id="editor" class="editor-field"></div>');

      var canvasX = self.canvas.offset().left;
      var canvasY = self.canvas.offset().top;
      var canvOffX = self.canvas.parent().offset().left - canvasX;
      var canvOffY = self.canvas.parent().offset().top - canvasY;

      var canvasW = self.canvas.attr('width');
      var canvasH = self.canvas.attr('height');

      self.thumbWidth = 40;
      self.thumbHeight = 40;


      // Get main div jquery wrapper
      var main = self.canvas.parent().parent().parent();

      // Get canvas wrapper div jquery wrapper
      var canvWrapper = self.canvas.parent();


      /* sub-elements for class panel */
      var titleClass = $('<p class="module-title" style="font-size: 80%">Class Panel</p>')
      var nameTextBox = $('<input id="classname" type="text" style="font-size: 80%; color: black" name="customclass" placeholder="enter a class name">');
      var addBtn = $('<button id="add" class="decisionBtn" style="font-size: 90%; color: black">add</button>');
      //var addscBtn = $('<button id="addsc" class="decisionBtn" style="font-size: 90%; color: black">add subclass</button>');
      var errorMsg = $('<p id="errorMsg" class="error" style="display: none"></p>')
      var clearClassBtn = $('<button id="clear" class="decisionBtn" style="font-size: 90%; color: black">clear</button>');
      var colorSelector = $('#colorSelector');
      var hiddenInput = $('#color_value');
      var selectFrame = $('<div id="selectFrame" class="hierarchy-div" style="font-size: 90%; color: black"></div>');
      var addToHieBtn = $('<button id="tohie" class="decisionBtn" style="font-size: 90%; color: black">add to</button>');
      var hieOptions = $('<select id="hieopt" class="decisionBtn" style="font-size: 90%; color: black"></select>');
      var deleteBtn = $('<button id="delete" class="decisionBtn" style="font-size: 90%; color: black">delete</button>');
      var deleteAllBtn = $('<button id="delete all" class="decisionBtn" style="font-size: 90%; color: black">delete all</button>');
      var connectWrapper = $('<div></div>');

      // for being able to globally accessed by functions
      self.$errorMsg = errorMsg;
      self.$hieOptions = hieOptions;

      self.$selectClassFrame = selectFrame;

      selectFrame.tree({
        data: null,
      });

      connectWrapper.append(addToHieBtn);
      connectWrapper.append(hieOptions);

      var defaultColor = hiddenInput.val();

      self.$classPanelWrapper.append(titleClass);
      self.$classPanelWrapper.append(nameTextBox);
      self.$classPanelWrapper.append(errorMsg);
      self.$classPanelWrapper.append(colorSelector);
      self.$classPanelWrapper.append(hiddenInput);
      self.$classPanelWrapper.append(addBtn);
      self.$classPanelWrapper.append(clearClassBtn);
      self.$classPanelWrapper.append(selectFrame);
      self.$classPanelWrapper.append(connectWrapper);
      self.$classPanelWrapper.append(deleteBtn);
      self.$classPanelWrapper.append(deleteAllBtn);

      /* sub-elements for history panel*/
      var titleHis = $('<p class="module-title" style="font-size:80%">History Panel</p>')
      var undoBtn = $('<button id="undoHis" style="font-size: 90%; color: black" class="decisionBtn op-his">undo</button>');
      var redoBtn = $('<button id="redoHis" style="font-size: 90%; color: black" class="decisionBtn op-his">redo</button>');
      var clearHisBtn = $('<button id="clearHis" style="font-size: 90%; color: black" class="op-his">clear History</button>');
      var clearPosBtn = $('<button id="clearPos" style="font-size: 90%; color: black" class="op-his">clear PosPoints</button>');
      var clearNegBtn = $('<button id="clearNeg" style="font-size: 90%; color: black" class="op-his">clear NegPoints</button>');
      var clearRectBtn = $('<button id="clearRect" style="font-size: 90%; color: black" class="op-his">clear Rectangle</button>');
      var historyFrame = $('<table id="historyFrame" class="table table-hover panel-frame"></table>');
      historyFrame.append($('<thead><tr><th>Action</th><th>Thumbnail</th></tr></thead><tbody id="panelBody"></tbody>'))

      // For being able to globally accessed by functions.
      self.$historyFrame = historyFrame;

      self.$hisPanelWrapper.append(titleHis);
      self.$hisPanelWrapper.append(undoBtn);
      self.$hisPanelWrapper.append(redoBtn);
      self.$hisPanelWrapper.append(historyFrame);
      //self.$hisPanelWrapper.append(clearHisBtn);
      self.$hisPanelWrapper.append(clearPosBtn);
      self.$hisPanelWrapper.append(clearNegBtn);
      self.$hisPanelWrapper.append(clearRectBtn);


      /* sub-elements for tool kit*/
      var lineWidth = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      var algorithms = ['DL-ObjectSelect', 'Manual']; //'GrabCut' can add back into options
      var titleTool = $('<p class="module-title">Toolkit</p>')
      //var polygon = $('<span class="toolkit-item" style="font-size: 115%"><i class="fa fa-map-o" aria-hidden="true"></i>&nbsp Polygon</span>');
      var semFile = $('<button style="font-size: 100%" class="toolkit-item" onclick="document.getElementById(\'semFile\').click()">Upload a mask</button> <input type="file" accept="image/*" id="semFile" name="semFile" style="display:none">');
      // var semFile = $('<label for="semFile" class="btn">Upload a mask</label> <input type="file" accept="image/*" id="semFile" name="semFile" style="display:none">');
      var posPencil = $('<span class="toolkit-item" style="font-size: 115%"><i class="fa fa-pencil" aria-hidden="true"></i>&nbsp posPen</span>');
      var negPencil = $('<span class="toolkit-item" style="font-size: 115%"><i class="fa fa-pencil" aria-hidden="true"></i>&nbsp negPen</span>');
      var rectangle = $('<span class="toolkit-item" style="font-size: 115%"><i class="fa fa-square-o" aria-hidden="true"></i>&nbsp Rectangle</span>');
      var newLine   =$('<br/>')
      var lineWidthText = $('<span style="font-size:110%; font-weight:bolder; color:black; display:inline-block">line width:</span>');
      var strokeOptions = $('<select id="selWidth" style="margin:5px; margin-left:10px; margin-right:30px; width:50px" ></select>');
      var modeText = $('<span style="font-size:110%; font-weight:bolder; color: black; display:inline-block">mode:</span>');
      var modeOptions = $('<select id="selMode" style="margin:5px; margin-left:10px; margin-right:30px; width:150px" ></select>');
      var processData = $('<button id="perform" class="op-his" style="font-size: 100%; color: black; border: 2px solid green; min-width:fit-content;"><i class="fa fa-play"></i>  Process</button>');


      for (var i = 0; i < lineWidth.length; i++){
        var option = $('<option value=' + lineWidth[i].toString() +'>'+ lineWidth[i].toString() +'</option>');
        strokeOptions.append(option);
      }

      for (var i = 0; i < algorithms.length; i++){
        var mode = $('<option value=' + algorithms[i] + '>' + algorithms[i] + '</option>');
        modeOptions.append(mode);
      }

      self.lineWidth = parseInt(strokeOptions.val());
      self.curMode = modeOptions.val();

      self.$toolKitWrapper.append(titleTool);
      //self.$toolKitWrapper.append(polygon);
      self.$toolKitWrapper.append(semFile);
      self.$toolKitWrapper.append(posPencil);
      self.$toolKitWrapper.append(negPencil);
      self.$toolKitWrapper.append(rectangle);
      self.$toolKitWrapper.append(newLine)
      self.$toolKitWrapper.append(lineWidthText);
      self.$toolKitWrapper.append(strokeOptions);
      self.$toolKitWrapper.append(modeText);
      self.$toolKitWrapper.append(modeOptions);
      self.$toolKitWrapper.append(processData);

      /* sub-elements for hierarchy */
      var titleHie = $('<p class="module-title" style="font-size: 90%">Object Panel</p>')
      var hieNameTextBox = $('<input id="hiename" type="text" style="font-size: 90%" name="customhie" placeholder="enter a object name">');
      // TODO: change the variables name
      var selectClasses = $('<ul id="listSC" style = "list-style: none; height: 120px; overflow-y: scroll; margin: 0 0 1em 0"></ul>');
      var addHieBtn = $('<button id="addHie" class="decisionBtn add-hie" style="font-size: 90%; color: black">add</button>');
      var errorHieMsg = $('<p id="errorMsg" class="error" style="display: none"></p>')
      var clearHieBtn = $('<button id="clear" class="decisionBtn" style="font-size: 90%; color: black">clear</button>');
      var selectHieFrame = $('<div id="selectHieFrame" class="hierarchy-div"></div>');
      var eraseHieBtn = $('<button id="eraseHie" class="decisionBtn" style="font-size: 90%; color: black">erase mask</button>');
      var deleteHieBtn = $('<button id="deleteHie" class="decisionBtn" style="font-size: 90%; color: black">delete</button>');
      var deleteAllHieBtn = $('<button id="deleteAllHie" class="decisionBtn" style="font-size: 90%; color: black">delete all</button>');
      var addClassToHieBtn = $('<button id="classToHie" class="decisionBtn add-hie" style="font-size: 90%; color: black">add class</button>')
      var addClassToHieOpt = $('<select id="class-hie-opt" class="dicisionBtn" style="font-size: 90%; color: black"></select>')

      // for being able to globally accessed by functions
      self.$errorHieMsg = errorHieMsg;
      self.$selectHieFrame = selectHieFrame;
      self.$selectClasses = selectClasses;

      selectHieFrame.tree({
        data: null,
        onCreateLi: function(node, $li) {
          $li.find('.jqtree-title').after('<div id=hie' + node.id + ' style="display:none;"></div>');
        },
      });

      self.$hierarchyWrapper.append(titleHie);
      self.$hierarchyWrapper.append(hieNameTextBox);
      self.$hierarchyWrapper.append(selectClasses);

      function selectClassOnHiePanel(e){
        var text = document.getElementById("text");
        var checkBox = e.currentTarget;
        var classInf = new ClassInfo(checkBox.name, checkBox.id);
        if(checkBox.checked == true){
          self.checkedClasses.push(classInf);
        } else {
          var j;
          for(i = 0; i < self.checkedClasses.length; i++){
            if(self.checkedClasses[i].name === checkBox.name){
              j = i;
            }
          }
          self.checkedClasses.splice(j, 1);
        }

      };
      self.selectClassOnHiePanel = selectClassOnHiePanel

      self.$hierarchyWrapper.append(errorHieMsg);
      self.$hierarchyWrapper.append(addHieBtn);
      self.$hierarchyWrapper.append(clearHieBtn);
      self.$hierarchyWrapper.append(selectHieFrame);
      self.$hierarchyWrapper.append(eraseHieBtn);
      self.$hierarchyWrapper.append(deleteHieBtn);
      self.$hierarchyWrapper.append(deleteAllHieBtn);

      /* actions for hierarchy panel */
      addHieBtn.on('click', function(){
        var hieName = hieNameTextBox.val();
        var item = {'name': hieName, 'classes': new Array()};
        self.addHierarchy(item, selectHieFrame, errorHieMsg, hieOptions);
        hieNameTextBox.val('');
        for(i = 0; i < self.checkedClasses.length; i++){
          self.addOneSubNode(item.id, selectHieFrame, self.checkedClasses[i]);
        }

        self.renderHierarchyFrame();
      });

      function hasId(element){
        return typeof element.id != 'undefined';
      }
  
      function search(object_, id_){
        for (var i=0; i < object_.length; i++) {          
          if (hasId(object_[i]) && object_[i].id === id_) {              
              return object_[i];
          }
        }
        return null;
      }
    
      semFile.on('change', function(e){
        var idx = -1;
        e.preventDefault(); 

        // we can find id using the current image
        var gallery = self.$galleryMain;                
        var obj;        
        gallery.find('figure').each(function(index){
          obj = search($(this), 'prevImage');          
          if (obj!=null){
            idx = index;
            return false;
          }   
        });

        if(idx == -1){
          alert("Error while loading the file.");
        }
        else{
          var w = 0, h = 0;
          var img = new Image();
          $(img).load(function(){
            w = this.width;
            h = this.height;           
          });
          img.src = $('#image-' + idx.toString()).attr('src');          

          (function(file){  
            var ext = file.name.split(".").pop();
            if (ext=='tif' || ext=='tiff'){
              var reader = new FileReader();
              $(reader).load(function(e){                                     
                reader.onloadend = function(){                     
                  $('#semimage-' + idx.toString()).attr('src', this.result);                 
                  self.canvasDataSem = this.result;  
                };        
              })          
              reader.readAsDataURL(file);
            }
            else{
              alert("Does not supported "+ext+" file format for the mask. Please upload a tif or tiff file.");
            }
          })(this.files[0]);          
        }
      });

      hieNameTextBox.on('focus', function(e){
        e.preventDefault();
        errorHieMsg.hide();
      });

      clearHieBtn.on('click', function(e){
        e.preventDefault();
        errorHieMsg.hide();
        hieNameTextBox.val('');
      })

      selectHieFrame.bind('tree.click', function(e){
        e.preventDefault();
        var node = e.node
        // if no change
        if(self.selectedHie && self.selectedHie['id'] === node['id']){
            console.log("selectHieFrame node no change");
            return;
        }

        // remove old highlight-class and assign the new one.
        self.updateHieHighlight(node.id);

        // reset for new annotation
        self.classChange = true;
        self.negPoints = new Array();
        self.posPoints = new Array();
        self.ctxP.clearRect(0, 0, self.width, self.height);
        self.drawRect(self.ctxP);
      });

      eraseHieBtn.on('click', function(e){
          e.preventDefault();
          if (!self.selectedHie){
            alert('Please select an item to delete.');
            return false;
          }

          var stack = self.hierarchyStack;
          var element = self.selectedHie.element;
          var node = self.selectedHie;
          var objname = node.parent.name;
          var clsname = node.name

          if(self.selectedHie['color'] && (objname in self.labelWorking['pos']) &&
             (clsname in self.labelWorking['pos'][objname])){
              delete self.labelWorking['pos'][objname][clsname]
              delete self.labelWorking['edge'][objname][clsname]
              delete self.labelWorking['locked'][objname][clsname]
              delete self.labelFinal['pos'][objname][clsname]
              delete self.labelFinal['edge'][objname][clsname]
              delete self.labelFinal['locked'][objname][clsname]

              if (Object.entries(self.labelWorking['pos'][objname]).length == 0){
                  delete self.labelWorking['pos'][objname]
                  delete self.labelWorking['edge'][objname]
                  delete self.labelWorking['locked'][objname]
                  delete self.labelFinal['pos'][objname]
                  delete self.labelFinal['edge'][objname]
                  delete self.labelFinal['locked'][objname]

                  self.labelWorking['numObj'] -= 1
                  self.labelFinal['numObj'] -= 1
              }
              self.renderHierarchyFrame();
              self.renderDict(self.labelWorking, self.maskType);

              self.addHistory('erase', 1);
          }
      });

      deleteHieBtn.on('click', function(e){
        e.preventDefault();
        if (!self.selectedHie){
          alert('Please select an item to delete.');
          return false;
        }
        eraseHieBtn.click();

        var stack = self.hierarchyStack;
        var element = self.selectedHie.element;
        var node = self.selectedHie;

        // Find corresponding hierarchy
        if (self.selectedHie['color']){
          // remove from stack
          for(var i=0; i<stack.getSize(); i++){
              var element = stack.find(i);
              if(element['id'] !== node.parent['id']){
                  continue
              }
              var classes = element['classes'];
              for (var j = 0; j < classes.length; j++){
                  if (self.selectedHie.color === classes[j]['color']){
                    classes.splice(j, 1);
                    break;
                  }
              }
          }

          // remove from tree
          selectHieFrame.tree('removeNode', node);
          self.selectedHie = null;
          self.renderHierarchyFrame();
        }else{
          selectHieFrame.tree('removeNode', node);
          self.selectedHie = null;
          hieOptions.find('option').filter(function(i, e){
            return $(e).val() == node.id;
          }).remove();
          stack.delete(i);
          self.selectedHie = null;
          self.renderHierarchyFrame();
        }
      });

      // Function to lock and unlock on double click.
      selectHieFrame.on('dblclick', function(e){
        e.preventDefault();

        if (!self.selectedHie['color']){
          alert('Please select an item to lock.');
          return false;
        }

        // check if selected subNode is labeled
        var ann_locked = self.labelWorking.locked;
        var objName  = self.selectedHie.parent['name'];
        var clsName  = self.selectedHie['name'];
        if(objName in ann_locked && clsName in ann_locked[objName]){
            self.labelWorking.locked[objName][clsName] = ann_locked[objName][clsName]? false:true;
            self.renderHierarchyFrame();
        }else{
            alert('Please label the item first, then lock/unlock.');
        }
        ann_locked = self.labelFinal.locked;
        if(objName in ann_locked && clsName in ann_locked[objName]){
            self.labelFinal.locked[objName][clsName] = ann_locked[objName][clsName]? false:true;
        }
      });

      deleteAllHieBtn.on('click', function(e){
        e.preventDefault();
        self.selectedHie  = null;

        self.hierarchyStack = new infoStack(self.stackType['class'], self.maxsize_hierarchyStack);
        self.removeAllHies();
        self.hieUid = 0;

        //remove the information of all the objects.
        self.labelWorking.locked = {};
        self.labelFinal.locked   = {};

        self.renderDict(self.labelWorking, self.maskType);
        self.renderHierarchyFrame();
      });


      /* actions for class panel*/
      colorSelector.css({
        'position': 'relative',
        'display': 'block',
        'margin': '0 auto',
        'top': 10,

      });

      nameTextBox.on('focus', function(e){
        e.preventDefault();
        errorMsg.hide();
      });

      hiddenInput.on('change', function(e){
        e.preventDefault();

        // Make text color contrast.
        var hexcolor = $(this).val()
        var textcolor = self.contrastColor(hexcolor);
        colorSelector.css('color',textcolor);

      });

      addBtn.on('click', function(e){
        e.preventDefault();
        var pickedColor = hiddenInput.val();
        var enteredName = nameTextBox.val();

        if(!enteredName){
          errorMsg.text('Please Type a Class Name');
          errorMsg.show();
        }else{
          var added = self.addAnnoClass(enteredName, pickedColor, null, self.$selectClassFrame, errorMsg);
          if(added){
            self.addAnnoClassToHiePanel(enteredName, pickedColor)
          }
          nameTextBox.val('');
        }
      });


      clearClassBtn.on('click', function(e){
        e.preventDefault();
        errorMsg.hide();
        colorSelector.css('background-color', '#' + defaultColor.toString());
        hiddenInput.val(defaultColor);
        nameTextBox.val('');
      });

      addToHieBtn.on('click', function(e){
        e.preventDefault();
        var chosenHie = hieOptions.val();
        var classInfo = new ClassInfo(self.selectedClass.name, self.selectedClass.color);
        self.addOneSubNode(chosenHie, selectHieFrame, classInfo);
      });

      deleteBtn.on('click', function(e){
        var candidate = self.selectedClass;
        var node = self.$selectClassFrame.tree('getNodeById', candidate.uid);

        if($(node.element).children('div').hasClass('highlight')){
          self.deleteClass(self.classStack, node);
          var itemToRemove = document.getElementById(candidate.color).parentNode;
          itemToRemove.remove();
          self.selectedClass = null;
        }else{
          alert('Please select a class name to delete!');
          return;
        }
      });

      deleteAllBtn.on('click', function(e){
        var stack = [new AnnoClass(-1, null, self.classStack, null, null)];
        var cur, each;
        var children;

        while(cur = stack.pop()){
          children = cur.subClasses;
          for (var i = 0; i < children.getSize(); i++){
            var uid = children.find(i).uid;
            var node = self.$selectClassFrame.tree('getNodeById', uid);
            self.$selectClassFrame.tree('removeNode', node);
          }
        }
        var checkboxes = document.getElementById('listSC');
        while(checkboxes.firstChild){
          checkboxes.removeChild( checkboxes.firstChild);
        }

        self.classStack = new infoStack(self.stackType['class'], self.maxsize_classStack);
        self.selectedClass = null;
        self.calssUid = 0;
      });

      // TODO: view
      self.$selectClassFrame.bind('tree.click', function(e){
        e.preventDefault();
        if(self.selectedClass){
            $(self.selectedClass.element).children('div').removeClass('highlight');
        }
        self.selectedClass = e.node;
        $(self.selectedClass.element).children('div').addClass('highlight');
      });

      /* actions for toolkit and canvas*/
      $(document).on('click', '.toolkit-item', function(e){
        var selected = $(this).hasClass('highlight');
        $('.toolkit-item').removeClass('highlight');
        if(!selected){
          $(this).addClass('highlight');
        }
        self.curTool = $(this).text().trim();
        self.metaData = new Array();
      });

      self.canvasP.on({
        mousemove: function(e){
          self.handleMousemove(e, this, historyFrame)
        },
        mousedown: function(e){
          self.handleMousedown(e, this, historyFrame);
        },
        mouseup: function(e){
          self.handleMouseup(e, this, historyFrame);
        },
        mouseleave: function(e){
          self.handleMouseleave(e, this, historyFrame);
        }
      });

      strokeOptions.on('change', function(e){
        self.lineWidth = parseInt($(this).val());
      });
      modeOptions.on('change', function(e){
        self.curMode = $(this).val();
      });


      /* history panel actions */
      undoBtn.on('click', function(e){
        self.undoOnce();
      });

      redoBtn.on('click', function(e){
        self.redoOnce();
      });

      clearHisBtn.on('click', function(e){
        self.removeAllHis();
        self.historyStack = new infoStack(self.stackType['history'], self.maxsize_historyStack);
        self.historyStack.add({tool:'null'});
        var bbox = {bboxData: null,
                    isBox: false,
                    start_x: 0,
                    start_y: 0,
                    end_x: self.width,
                    end_y: self.height, };
        self.labelFinal = new Label();
        self.labelWorking = new Label();
        self.polygonPoints = new Array();
        self.posPoints = new Array();
        self.negPoints = new Array();

        self.ctxP.clearRect(0, 0, self.width, self.height);
        self.ctxM.clearRect(0, 0, self.width, self.height);
        self.nonscaledCtxM.clearRect(0, 0, self.nonscaledCtxM.canvas.width, self.nonscaledCtxM.canvas.height);
      });


      clearPosBtn.on('click', function(e){
        //to reset array
        self.posPoints = new Array();

        self.ctxP.clearRect(0, 0, self.width, self.height);
	    self.drawNegPoints(self.ctxP);
        self.drawRect(self.ctxP);
      });


      clearNegBtn.on('click', function(e){
        //to reset array
        self.negPoints = new Array();

        self.ctxP.clearRect(0, 0, self.width, self.height);
	    self.drawPosPoints(self.ctxP);
        self.drawRect(self.ctxP);
      });


      clearRectBtn.on('click', function(e){
        // to reset bounding box
        self.bbox = {
          bboxData: null,
          isBox: false,
          start_x: 0,
          start_y: 0,
          end_x: self.width,
          end_y: self.height,
        };

        self.clearRectFromCanvas();
      });


      processData.on('click', function(e){
          if(self.checkSelectedHie()){
              self.process_oneStep(historyFrame);
          }else{
              alert("Please select an object to start annotateion");
          }
      });


      var panelWidth = '14%';
      var mainWidth = main.width();


      // Style of wrappers
      self.$optionsWrapper.css({
        'width': panelWidth,
        'height': '800px',
      });

      self.$editorWrapper.css({
        'display': 'inline-block',
        'margin': '0 auto',
        'position': 'relative',
        'width': '70%',
        'height': '900px',
      });

      self.$classPanelWrapper.css({
        'width': '99%',
        'height': '500px',
      });

      self.$hierarchyWrapper.css({
        'width': '99%',
        'height': '500px',
      })

      self.$hisPanelWrapper.css({
        'width': panelWidth,
        'height': '500px',
      });

      self.$toolKitWrapper.css({
        'position': 'relative',
        'display': 'block',
        'width': '70%',
        'bottom': '50px',
        'height': '100px',
        'margin': '1% 14% 1% 14%',
      });


      /* images gallery */
      var galleryWrapper = $('<div id="gallery" class="gallery-wrapper"></div>');
      var galleryMain = $('<div id="gallery-main" class="gallery-content"></div>');
      var leftDiv = $('<div id="left-arrow" class="scroll-left gallery-arrows"><i class="scroll-left-icon fa fa-angle-double-left"></i></div>');
      var rightDiv = $('<div id="right-arrow" class="scroll-right gallery-arrows"><i class="scroll-right-icon fa fa-angle-double-right"></i></div>');

      // For being able to globally accessible by functions
      self.$galleryMain = galleryMain;
      var gallery_height = '120px'
      leftDiv.css({
        'display': 'inline-block',
        'margin': '0 auto',
        'position': 'relative',
        'height': gallery_height,
      });
      rightDiv.css({
        'display': 'inline-block',
        'margin': '0 auto',
        'position': 'relative',
        'height': gallery_height,
      });
      galleryMain.css({
        'display': 'inline-block',
        'margin': '0 auto',
        'position': 'relative',
        'height': gallery_height,
      });
      galleryWrapper.css({
        'display': 'inline-block',
        'margin': '0 auto',
        'position': 'relative',
        'height': gallery_height,
      });
      galleryWrapper.append(leftDiv);
      galleryWrapper.append(galleryMain);
      galleryWrapper.append(rightDiv);

      // Loading all images to gallery
      self.loadingGallery();

      $(document).on('click', '.image-item',function(e){
        if (confirm('Do you really what to switch image?')){
            // ALI
		    $("#prevImage").css('background-color', '#c0c0c0');
            $("#prevImage").attr("id", null);

            $(this).css('background-color', '#00fff0');
		    $(this).attr("id", "prevImage")

          if (self.storeState($(this))){
              self.restoreState($(this));            
          }
        }
      });

      leftDiv.on('click', function(){
        self.$galleryMain.animate({
          scrollLeft: '-=200px',
        })
      });

      rightDiv.on('click', function(){
        self.$galleryMain.animate({
          scrollLeft: '+=200px',
        })
      });


      /* File control */
      var fileControlerWarpper = $('<div id="fileControler" class="file-controler-warpper"></div>');
      var addImagesBtn = $('<button class="file-controler-item" style = "font-size: 90%; color: black">add images</button>');
      var hiddenAddBtn = $('<input id="addMore" type="file" name="morepic[]" multiple/>');
      var clearGalleryBtn    = $('<button class="file-controler-item" style = "font-size: 90%; color: black">clear gallery</button>');

      var importConfigBtn = $('<button class="file-controler-item" style = "font-size: 90%; color: black">import config</button>');
      var hiddenImportConfigBtn = $('<input id="configXML" type="file" name="morepic[]" multiple/>');
      var exportConfigBtn = $('<button class="config-export" style = "font-size: 90%; color: black">export config</button>');
      var file_newLine       =$('<br/>')

      var importAllBtn    = $('<button class="file-controler-item" style = "font-size: 90%; color: black">importAll</button>');
      var hiddenImportAllBtn = $('<input id="importTXT" type="file" name="morepic[]" multiple/>');
      var exportAllBtn = $('<button class="file-controler-item" style = "font-size: 90%; color: black">exportAll</button>');

      var readBtn = $('<button class="file-controler-item" style = "font-size: 90%; color: black">read label</button>');
      var hiddenReadBtn = $('<input id="readLabel" type="file" name="morepic[]" multiple/>');
      var saveBtn = $('<button class="file-controler-item" style = "font-size: 90%; color: black">save label</button>');
      var saveOptions = $('<select id="selSaveImgType" style="width:200px; display:inline-block" ></select>');

      var saveImageTypes = ["class in rgb", "object in rgb", "object-class in rgb", "object-class in gray"];
      for (var i = 0; i < saveImageTypes.length; i++){
        var mode = $('<option>' + saveImageTypes[i] + '</option>');
        saveOptions.append(mode);
      }


      fileControlerWarpper.append(addImagesBtn);
      fileControlerWarpper.append(clearGalleryBtn);
      fileControlerWarpper.append(importConfigBtn);
      fileControlerWarpper.append(exportConfigBtn);

      fileControlerWarpper.append(file_newLine);
      fileControlerWarpper.append(importAllBtn);
      fileControlerWarpper.append(exportAllBtn);
      fileControlerWarpper.append(readBtn);
      fileControlerWarpper.append(saveBtn);
      fileControlerWarpper.append(saveOptions);

      exportAllBtn.on('click', function(e){
        var name = self.images[self.curImgID].name;
        name = name.substring(0, name.lastIndexOf('.'));
        var cache = [];
        var request = {
          'classStack': self.classStack.data,
          'hierarchyStack': self.hierarchyStack.data,
          'historyStack': self.historyStack,
        }
        var json = JSON.stringify(request, function(key, value){
          if (typeof value === 'object'){// && value !== null) {
            if (cache.indexOf(value) !== -1) {
              return;
            }
            cache.push(value);
          }
          return value;
        });
        cache = null;

        // export saving as txt.
        // python parse it as dict: json.load(open('*.txt', 'r'))
        // javascript: refering to the hiddenImportAllBtn.on('click')
        var a = document.createElement("a");
        var file = new Blob([json], {type:'text/plain'});
        a.href = URL.createObjectURL(file);
        a.download = name+'_all.txt';
        a.click();

        self.labelFinal = JSON.parse(JSON.stringify(self.labelWorking));
      });

      exportConfigBtn.on('click', function(e){
        var name = self.images[self.curImgID].name;
        name = name.substring(0, name.lastIndexOf('.'));
        var cache = [];
        var request = {
          'classStack': self.classStack.data,
          'hierarchyStack': self.hierarchyStack.data,
        }
        var json = JSON.stringify(request, function(key, value){
          if (typeof value === 'object' && value !== null) {
            if (cache.indexOf(value) !== -1) {
            // Circular reference found, discard key
            return;
            }
            // Store value in our collection
            cache.push(value);
          }
          return value;
        });

        cache = null;
        self.sendConfigXMLRequest(json, name);
      });

      readBtn.on('click', function(e){
        e.preventDefault();
        hiddenReadBtn.click();
      });

      hiddenReadBtn.on('change', function(e){
        (function(file){
            var reader = new FileReader();
            $(reader).load(function(e){
                self.sendLabelParse(e.target.result)
            })
            reader.readAsDataURL(file);
        })(this.files[0]);
      });

      saveBtn.on('click', function(e){
        var pureLabel = self.renderMask(self.labelWorking, self.maskType);
        var name = self.images[self.curImgID].name;
        name = name.substring(0, name.lastIndexOf('.'));
        if(self.maskType==='class in rgb'){
            name = name + '_class';
        }else if(self.maskType==='object in rgb'){
            name = name + '_inst';
        }else if(self.maskType==='object-class in rgb'){
            name = name + '_inst_class_rgb';
        }else{ // 'object-class in gray'
            name = name + '_inst_class_gray';
        }
        var anchorMask = $('<a>').attr("href", pureLabel).attr("download", name+".png").appendTo("body");
        anchorMask[0].click();
        anchorMask[0].remove();
        self.labelFinal = JSON.parse(JSON.stringify(self.labelWorking));
      });

      saveOptions.on('change', function(e){
        self.maskType = $("#selSaveImgType option:selected").text();
        self.renderDict(self.labelWorking, self.maskType);

        var ele = document.getElementById('titleCanvas');
        if(self.maskType === 'class in rgb'){
          ele.innerHTML = 'mask in class-color';
          ele.style["color"] = "#f00";
        }else if(self.maskType==='object in rgb'){
          ele.innerHTML = 'mask in object-color';
          ele.style["color"] = "#00f";
        }else{
          ele.innerHTML = 'mask in object&class-color';
          ele.style["color"] = "#0f0";
        }
      });

      addImagesBtn.on('click', function(e){
        e.preventDefault();
        hiddenAddBtn.click();
      });

      importAllBtn.on('click', function(e){
        e.preventDefault();
        deleteAllBtn.click();
        deleteAllHieBtn.click();
        clearHisBtn.click();
        hiddenImportAllBtn.click();
      });

      importConfigBtn.on('click', function(e){
        e.preventDefault();
        deleteAllBtn.click();
        deleteAllHieBtn.click();
        clearHisBtn.click();
        hiddenImportConfigBtn.click();
      });

      hiddenAddBtn.on('change', function(e){
        var images = this.files;
        var imagesArr = Array.prototype.slice.call(images)

        var storedImages = self.images;
        var startIdx = storedImages.length;

        for (var i = startIdx; i < startIdx + images.length; i++){
          var rawName = images[i - startIdx].name;
          var block = $('<figure class="image-item"></figure>');
          var thumb = $('<img id="image-' + i.toString() + '" class="image-block" src="static/img/loading.gif"></img>');
          var semthumb = $('<img id="semimage-' + i.toString() +'" class="sem-block" src="static/img/semMask.tif"></img>');
          var name = $('<figcaption class="image-name">' + rawName.substr(0, rawName.lastIndexOf('.')) + '</figcaption>');

          block.append(thumb);
          block.append(semthumb);
          block.append(name);
          galleryMain.append(block);

          (function(file, idx){
            var reader = new FileReader();

            $(reader).load(function(e){          
              $('#image-' + idx.toString()).attr('src', e.target.result);
            })
            reader.readAsDataURL(file);
          })(images[i - startIdx], i);

        }
        self.images = self.images.concat(imagesArr);

      });

      hiddenImportAllBtn.on('change', function(e){
        var files = this.files;
        var file = files[0];
        if (file.type === 'text/plain'){
          var reader = new FileReader();
          reader.onload = function(e){
            var content = this.result;
            var dict = JSON.parse(content);
            self.decodeAllTXT(dict);
            self.addHistory('import', 1);
          }
          reader.readAsText(file);
        }else if(file.type === 'text/xml'){
          var reader = new FileReader();
          reader.onload = function(e){
            var content = this.result;
            var xmlDoc = $.parseXML(content);
            var $xml = $(xmlDoc);
            self.decodeAllXML($xml);
            self.addHistory('import', 1);
          }
          reader.readAsText(file);
        }else{
          alert('Please import txt file.');
        }


      });

      hiddenImportConfigBtn.on('change', function(e){
        var files = this.files;
        var file = files[0];
        if (file.type === 'text/xml'){
          var reader = new FileReader();

          reader.onload = function(e){
            var content = this.result;
            var xmlDoc = $.parseXML(content);
            var $xml = $(xmlDoc);
            self.decodeConfigXML($xml);
          }
          reader.readAsText(file);

        }else{
          alert('Please import xml file.');
        }

      });

      clearGalleryBtn.on('click', function(e){
        self.removeAllHis();
        self.removeAllFiles();
        self.clicksCanvas = 0;
        self.clicksLabel = 0;
        self.scaleCanvas = 1;
        self.scaleLabel = 1;
        self.canvas[0].width = 0;
        self.canvas[0].height = 0;
        self.canvasP[0].width = 0;
        self.canvasP[0].height = 0;
        self.width = 0;
        self.height = 0;
        self.nonscaledCanvas = $("<canvas>").attr("width", self.width).attr("height", self.height)[0];
        self.nonscaledCanvasM = $("<canvas>").attr("width", self.width).attr("height", self.height)[0];
        self.nonscaledCanvasSem = $("<canvas>").attr("width", self.width).attr("height", self.height)[0];
        self.bbox = {
            bboxData: null,
            isBox: false,
            start_x: 0,
            start_y: 0,
            end_x: self.width,
            end_y: self.height,
        };
        self.polygonPoints = new Array();
        self.posPoints = new Array();
        self.negPoints = new Array();
        self.labelFinal = new Label();
        self.labelWorking = new Label();
        self.curImgID = -1;
      });



      /* Tabs for canvas and results*/
      var mainTabsWrapper = $('<div id="mainTabs" class="tabsWrapper"></div>');

      /* Zoom in button and Zoom out button */
      var ZoomIn = $('<button id="zoomin" class="zoom" style="margin-right:10px; color:black"><i class="fa fa-plus-circle"></i> zoom in </button>');
      var ZoomOut = $('<button id="zoomout" class="zoom" style="margin-left:10px; color:black"><i class="fa fa-minus-circle"></i> zoom out </button>');
      var opacityText = $('<span style="font-size:70% color: black" display:inline-block">Opacity</span>');
      var opacitySlider = $('<input id="opcSlider" type="range" min="0.0" max= "1.0" step="0.05" style="width:30%">');
      var titleCanvas = $('<p id="titleCanvas" class="zoom" style="font-size: 90%; color: red; display:inline-block">mask in class-color</p>');

      mainTabsWrapper.append(ZoomIn);
      mainTabsWrapper.append(opacityText);
      mainTabsWrapper.append(opacitySlider);
      mainTabsWrapper.append(ZoomOut);
      mainTabsWrapper.append(titleCanvas);

      opacitySlider.change(function(){
        var opac = this.value;
        //self.ctxP.canvas.style.opacity = opac;
        self.ctxM.canvas.style.opacity = opac;
      });

      ZoomIn.on('click', function(e){
        e.preventDefault();
        // for canvas zooming
        if (self.clicksCanvas < 10){
          self.clicksCanvas += 1;
          self.zoomingCanvas(1.2, 1);
        }
      });

      ZoomOut.on('click', function(e){
        e.preventDefault();
        if (self.clicksCanvas >= -10){
            self.clicksCanvas -= 1;
            self.zoomingCanvas(1.2, -1);
        }
      });

      mainTabsWrapper.css({
        'display': 'inline-block',
        'margin': '0 auto',
        'position': 'relative',
        'margin-bottom': '5px'
      });
      self.$editorWrapper.append(mainTabsWrapper);
      self.$editorWrapper.append(separator);
      self.$editorWrapper.append(canvWrapper);
      self.$editorWrapper.append(galleryWrapper);
      self.$editorWrapper.append(fileControlerWarpper);

      /* Tabs for options */
      var tabsWrapper = $('<div id="panelTabs" class="tabsWrapper"></div>');
      var classPanelOption = $('<li><a href="#class-tab">Class</a></li>');
      var hierarchyPanelOption = $('<li><a href="#hierarchy-tab">Object</a></li>');
      var tabsBar = $('<ul id="class-object-selector" class="tabs"></ul>');
      var separator = $('<hr/>');

      tabsBar.append(classPanelOption);
      tabsBar.append(hierarchyPanelOption);
      tabsWrapper.append(tabsBar);

      self.$optionsWrapper.append(tabsWrapper);
      self.$optionsWrapper.append(separator);
      self.$optionsWrapper.append(self.$classPanelWrapper);
      self.$optionsWrapper.append(self.$hierarchyWrapper);

      // append to section
      $('#content').append(self.$editorWrapper);
      self.$toolKitWrapper.insertBefore(self.$editorWrapper);
      self.$optionsWrapper.insertBefore(self.$editorWrapper);
      self.$hisPanelWrapper.insertAfter(self.$editorWrapper);

      function callback(mutationsList, observer) {
          if(mutationsList[0].target.className === "active"){
            var currentInput = document.getElementById('classname');
            currentInput.focus();
            $('#classname').keypress(function(e){
              if (e.which == 13){
                if(currentInput.value.length > 0){
                  $("#add").click();
                }
              }
            });
          }
          else{
            if(self.hierarchyStack.getSize() > 0){
                self.updateHieHighlight(1);
            }
            var currentInput = document.getElementById('hiename');
            currentInput.focus();
            $('#hiename').keypress(function(e){
              if (e.which == 13){
                if(currentInput.value.length > 0){
                  $("#addHie").click();
                }
              }
            });
          }
      }

      const mutationObserver = new MutationObserver(callback);
      mutationObserver.observe(
        document.getElementById("class-object-selector").querySelectorAll('li')[0],
        { attributes: true }
      );

      panelWidth = self.$optionsWrapper.width();
      // offset is calculated by the width of main div substract the width of canvas and two panels,
      // then divided by 2. This is distance between canvas and panels. 20 bias term for move inside a little bit.
      var offset = (mainWidth - self.$editorWrapper.width() - 2 * panelWidth) / 2 - 20;

      self.$optionsWrapper.css('right', offset);
      self.$hisPanelWrapper.css('left', offset);

      $(window).resize(function() {
        var mainWidth = main.width();
        var panelWidth = self.$optionsWrapper.width();
        var offset = (mainWidth - self.$editorWrapper.width() - 2 * panelWidth) / 2 - 20;
        self.$optionsWrapper.css('right', offset);
        self.$hisPanelWrapper.css('left', offset);
      });

      // Switch between tabs
      $('#panelTabs ul.tabs li:first').addClass('active');
      self.$hierarchyWrapper.hide();
      self.$classPanelWrapper.show();
      $('#panelTabs ul.tabs li').on('click',function(){
        $('#panelTabs ul.tabs li').removeClass('active');
        $(this).addClass('active')
        $('.optionsele').hide();
        var activeTab = $(this).find('a').attr('href');
        $(activeTab).show();

        // Initialize all state of the table.
        self.initializeOptionPanel();
        return false;
      });


      // Switch between canvas and result
      $('#mainTabs ul.tabs li:first').addClass('active');
      canvWrapper.show();

      $('#mainTabs ul.tabs li').on('click',function(){
        $('#mainTabs ul.tabs li').removeClass('active');
        $(this).addClass('active')
        $('.mainoptionele').hide();
        var activeTab = $(this).find('a').attr('href');
        $(activeTab).show();
        galleryWrapper.show();

        return false;
      });
    },

    zoomingCanvas: function(scaleFactor, exp){
        var self = this;
        var factor = Math.pow(scaleFactor, exp);
        var stack = self.historyStack;

        self.scaleCanvas *= factor
        var newWidth = self.width * self.scaleCanvas;
        var newHeight = self.height * self.scaleCanvas;

        self.ctx.canvas.width = newWidth;
        self.ctx.canvas.height = newHeight;
        var margin = self.canvas.css('margin');

        // re-render image
        var copiedCanvas = $('<canvas>').attr({
          width: self.width,
          height: self.height,
        })[0];
        var imgData = self.nonscaledCtx.getImageData(0, 0, self.width, self.height);
        copiedCanvas.getContext("2d").putImageData(imgData, 0, 0);
        self.ctx.scale(self.scaleCanvas, self.scaleCanvas);
        self.ctx.clearRect(0, 0, self.width, self.height);
        self.ctx.drawImage(copiedCanvas, 0, 0);

        // re-render mask
        self.ctxM.canvas.width = newWidth;
        self.ctxM.canvas.height = newHeight;
        var copiedCanvasMask = $('<canvas>').attr({
          width: self.width,
          height: self.height,
        })[0];
        var maskData = self.nonscaledCtxM.getImageData(0, 0, self.width, self.height)
        copiedCanvasMask.getContext("2d").putImageData(maskData, 0, 0);
        self.ctxM.scale(self.scaleCanvas, self.scaleCanvas);
        self.ctxM.clearRect(0, 0, self.width, self.height);
        self.ctxM.drawImage(copiedCanvasMask, 0, 0);

        // re-render point layer
        self.ctxP.canvas.width = newWidth;
        self.ctxP.canvas.height = newHeight;
        self.ctxP.scale(self.scaleCanvas, self.scaleCanvas);
        self.ctxP.clearRect(0, 0, self.width, self.height);
        self.drawPosPoints(self.ctxP);
        self.drawNegPoints(self.ctxP);
        self.drawRect(self.ctxP);
    },


    removeAllHis: function(){
      var self = this;
      self.$historyFrame.find('tr').each(function(index){
        if (index != 0){
          $(this).remove();
        }
      });

      while(self.historyStack.getSize()>0){// && self.historyStack.peek().tool !== 'null'){
          self.historyRedoStack.add(self.historyStack.peek());
          self.historyStack.delete(self.historyStack.curIdx-1);
      }
    },
    removeAllHies: function(){
      var self = this;
      var tree = self.$selectHieFrame.tree('getTree');
      var children = tree['children'];

      // Remove all nodes in hierarchy
      while (children.length != 0){
        self.$selectHieFrame.tree('removeNode', children[children.length-1]);
      }

      // Remove options in select tag
      self.$hieOptions.find('option').remove();
    },
    removeAllFiles: function(){
      var self = this;
      self.images.length = 0;

      var gallery = self.$galleryMain;
      gallery.find('figure').each(function(index){
        $(this).remove();
      });
    },

    initializeOptionPanel: function(){
      var self = this;
      self.$classPanelWrapper.find('.highlight').removeClass('highlight');
      self.$hierarchyWrapper.find('.highlight-class').removeClass('highlight-class');

      if (self.selectedClass && self.selectedClass.uid >= 0){
        var node = self.$selectClassFrame.tree('getNodeById', self.selectedClass.uid);
        $(node.element).children('div').css('background-color', '');
      }

      self.selectedClass  = null;
      self.selectedHie  = null;
    },

    storeState: function(figure){
      var self = this;
      var cid = self.curImgID;

      var sid = figure.find('img').attr('id');
      var nid = parseInt(sid.substring(sid.indexOf('-')+1, sid.length));

      if (cid == nid){
        return false;
      }

      var states = self.states;
      // Deep copy
      var history = $.extend(true, {}, self.historyStack);
      var hierarchy = $.extend(true, {}, self.hierarchyStack);

      // Copy image data
      var dst = self.ctx.createImageData(self.imageData.width, self.imageData.height);
      dst.data.set(self.imageData.data);
      var copiedImageData = dst;

      var state = new State(history, hierarchy, self.nonscaledCanvas.toDataURL(), copiedImageData);
      states[cid] = state;
      return true;

    },

    restoreState: function(figure){
      var self = this;
      var sid = figure.find('img').attr('id');
     
      var imgURL, semURL;
      figure.find('img').each(function(index){
        if ($(this).attr('class')=='image-block'){
          imgURL = $(this).attr('src');
        }
        else{          
          semURL = $(this).attr('src');
        }
      });
      // var imgURL = figure.find('img').attr('src');
      

      var nid = parseInt(sid.substring(sid.indexOf('-')+1, sid.length));
      var states = self.states;
      var state = states[nid];

      self.removeAllHis();
      self.historyStack = new infoStack(self.stackType['history'], self.maxsize_historyStack);
      self.historyStack.add({tool:'null'});
      $('#label-img').attr('src', '');

      var img = new Image();
      var canvas = self.canvas[0];

      $(img).load(function(){
        canvas.width = img.width;
        canvas.height = img.height;
        self.ctx.drawImage(img, 0, 0);

        self.width = self.ctx.canvas.width;
        self.height = self.ctx.canvas.height;
        self.clicksCanvas = 0;
        self.clicksLabel = 0;
        self.scaleCanvas = 1;
        self.scaleLabel = 1;
        self.imageData = self.ctx.getImageData(0, 0, self.width, self.height);
        self.nonscaledCanvas = $("<canvas>").attr("width", self.width).attr("height", self.height)[0];
        self.nonscaledCtx = self.nonscaledCanvas.getContext("2d");
        self.nonscaledCtx.putImageData(self.imageData, 0, 0);
        self.bbox = {
            bboxData: null,
            isBox: false,
            start_x: 0,
            start_y: 0,
            end_x: self.width,
            end_y: self.height,
        };
        console.log("in load");
        
        self.polygonPoints = new Array();
        self.posPoints = new Array();
        self.negPoint = new Array();
        self.labelFinal = new Label();
        self.labelWorking = new Label();
        self.canvasData = this.src;

        self.nonscaledCtxM.clearRect(0, 0, self.nonscaledCtxM.canvas.width, self.nonscaledCtxM.canvas.height);
        self.ctxM.canvas.width = self.width;
        self.ctxM.canvas.height = self.height;
        self.ctxM.clearRect(0, 0, self.width, self.height);

        self.ctxP.canvas.width = self.width;
        self.ctxP.canvas.height = self.height;
        self.ctxP.clearRect(0, 0, self.width, self.height);
        self.renderURL(self.canvasData, null);

        self.scaleCanvas = 1;
      });

      img.src = imgURL;
      $('#clearHis').click();

      // Load semantic data
      // var sem = new Image();
      // var canvasSem = self.canvasSem[0];
      // $(sem).load(function(){
      //   canvasSem.width = sem.width;
      //   canvasSem.height = sem.height;        
      //   if (sem.width != self.width || sem.height != self.height){
      //     alert("While image switch - The size of the masks don't match. Using the default blank mask");
      //     // self.nonscaledCtxSem.clearRect(0, 0, self.nonscaledCtxSem.canvas.width, self.nonscaledCtxSem.canvas.height);          
      //     self.ctxSem.fillStyle = 'black';          
      //     self.ctxSem.clearRect(0, 0, self.width, self.height);          
      //     self.ctxSem.rect(0, 0, 1000, 1000);  
      //     self.ctxSem.fillRect(0, 0, 1000, 1000);          
      //     // self.ctxSem.fill();          
      //     self.semCanvasData = self.ctxSem.getImageData(0, 0, self.width, self.height);
      //     self.nonscaledCanvasSem = $("<canvas>").attr("width", self.width).attr("height", self.height)[0];
      //     self.nonscaledCtxSem = self.nonscaledCanvasSem.getContext("2d");
      //     self.nonscaledCtxSem.putImageData(self.semCanvasData, 0, 0);
      //     self.canvasDataSem = self.nonscaledCanvasSem.toDataURL();                      
      //     $('#semimage-' + nid.toString()).attr('src', self.canvasDataSem);
      //   }
      //   else{
      //     self.ctxSem.drawImage(sem, 0, 0);
      //     self.semCanvasData = self.ctxSem.getImageData(0, 0, self.width, self.height);
      //     self.nonscaledCanvasSem = $("<canvas>").attr("width", self.width).attr("height", self.height)[0];
      //     self.nonscaledCtxSem = self.nonscaledCanvasSem.getContext("2d");
      //     self.nonscaledCtxSem.putImageData(self.semCanvasData, 0, 0);
      //     self.canvasDataSem = this.src;          
      //   }
      //   console.log("in semantic load");
      // });
      // sem.src = self.canvasDataSem;      

      self.curImgID = nid;

    },
    loadingGallery: function(){
      var self = this;
      var files = self.images;
      var gallery = self.$galleryMain;

      for (var i = 0; i < files.length; i++){
        var rawName = files[i].name;
        var style = i==0? '"background-color:#00fff0" id=prevImage': '"background-color:white"';
        var block = $('<figure class="image-item" style='+ style +'></figure>');
        var name = $('<figcaption class="image-name" style="color:black">' + rawName.substr(0, rawName.lastIndexOf('.')) + '</figcaption>');
        var thumb = $('<img id="image-' + i.toString() +'" class="image-block" src="static/img/loading.gif"></img>');
        var semthumb = $('<img id="semimage-' + i.toString() +'" class="sem-block" src="static/img/semMask.tif"></img>');
        
        block.append(thumb);
        block.append(semthumb);
        block.append(name);
        gallery.append(block);

        // immediately-invoked function expression (help asynchronization getting index of filereader)
        (function(file, idx){
          var reader = new FileReader();
          
          $(reader).load(function(e){
            $('#image-' + idx.toString()).attr('src', e.target.result);
          })
          reader.readAsDataURL(file);
        })(files[i], i);
      }
    },

    handleMousemove: function(e, canvas, historyFrame){
      e.preventDefault();
      var self = this;
      if (!self.mousePressed || !self.curTool){
          return;
      }
      if(!self.checkSelectedHie()){
        if (!self.curTool == 'Rectangle'){
            return;
        }
      }
      // event coordinate
      var x_off = e.pageX - $(canvas).offset().left;
      var y_off = e.pageY - $(canvas).offset().top;

      var scaled_x_off = (e.pageX - $(canvas).offset().left) / self.scaleCanvas;
      var scaled_y_off = (e.pageY - $(canvas).offset().top) / self.scaleCanvas;

      switch(self.curTool){
        case 'posPen':
          if (self.bbox.isBox && !self.withinBbox(scaled_x_off, scaled_y_off)){
            alert('out from bounding box...');
            self.mousePressed = false;
          }else{
            self.drawLine(x_off, y_off);
          }
          break;
        case 'negPen':
          if (self.bbox.isBox && !self.withinBbox(scaled_x_off, scaled_y_off)){
            alert('out from bounding box...');
            self.mousePressed = false;
          }else{
            self.drawLine(x_off, y_off);
          }
          break;
        case 'Polygon':
          break;
        case 'Rectangle':
          self.updateRectEnd(x_off, y_off);
          self.clearRectFromCanvas();
          self.drawRect(self.ctxP);
          break;
      }
    },

    handleMouseup: function(e, canvas, historyFrame){
      e.preventDefault();
      var self = this;
      // check if the tool and class is selected
      if (!self.curTool){
        return;
      }
      if(self.curTool==='posPen' || self.curTool ==='negPen'){
        self.addHistory(self.curTool, 2);
      }

      // event coordinate
      var x_off = e.pageX - $(canvas).offset().left;
      var y_off = e.pageY - $(canvas).offset().top;

      switch (self.curTool) {
        case 'posPen':
          if (!self.checkSelectedHie()){
            return;
          }
          break;
        case 'negPen':
          if (!self.checkSelectedHie()){
            return;
          }
          break;
        case 'Rectangle':
          if (self.mousePressed){
            self.updateRectEnd(x_off, y_off);
            self.clearRectFromCanvas();
            self.drawRect(self.ctxP);
            if(self.bbox.start_x > self.bbox.end_x){
              [self.bbox.start_x, self.bbox.end_x] = [self.bbox.end_x, self.bbox.start_x]
            }
            if(self.bbox.start_y > self.bbox.end_y){
              [self.bbox.start_y, self.bbox.end_y] = [self.bbox.end_y, self.bbox.start_y]
            }
          }
          break;
        case 'Polygon':
          break;
        default:
          console.log('Error!');
          return;
      }

      self.mousePressed = false;
      self.metaData = new Array();
    },

    withinBbox: function(x, y){
      var self = this;
      // console.log("bbox dims: " + self.bbox.start_x + ", " + self.bbox.start_y + ", " + self.bbox.end_x + ", " + self.bbox.end_y)
      return (x > Math.min(self.bbox.start_x, self.bbox.end_x) &&
              x < Math.max(self.bbox.start_x, self.bbox.end_x) &&
              y > Math.min(self.bbox.start_y, self.bbox.end_y) &&
              y < Math.max(self.bbox.end_y, self.bbox.start_y));

    },

    handleMousedown: function(e, canvas, historyFrame){
      var self = this;
      e.preventDefault();
      if (!self.curTool){
        return;
      }

      // event coordinate
      var x_off = e.pageX - $(canvas).offset().left;
      var y_off = e.pageY - $(canvas).offset().top;
      var scaled_x_off = (e.pageX - $(canvas).offset().left) / self.scaleCanvas;
      var scaled_y_off = (e.pageY - $(canvas).offset().top) / self.scaleCanvas;

      switch(self.curTool){
        case 'posPen':
          if (self.bbox.isBox && !self.withinBbox(scaled_x_off, scaled_y_off)){
            alert('Please draw inside the bounding box...');
            return;
          }
          if (!self.checkSelectedHie()){
            return;
          }
          self.drawLineBegin(x_off, y_off, 1);
          break;
        case 'negPen':
          if (self.bbox.isBox && !self.withinBbox(scaled_x_off, scaled_y_off)){
            alert('Please draw inside the bounding box...');
            return;
          }
          if (!self.checkSelectedHie()){
            return;
          }
          self.drawLineBegin(x_off, y_off, 1);
          break;
        case 'Polygon':
          if (!self.checkSelectedHie()){
            return;
          }
          if (self.bbox.isBox && !self.withinBbox(scaled_x_off, scaled_y_off)){
            alert('Please draw inside the bounding box...');
            return;
          }

          // if started a polygon draw
          if (self.polyStarted){
            var curPoly = self.polygonPoints[self.polygonPoints.length-1]['points'];
            // end polygon draw by clicking near the start point or reaching the max num of points
            if(Math.abs(scaled_x_off - curPoly[0].x) < self.POLY_END_CLICK_RADIUS && Math.abs(scaled_y_off - curPoly[0].y) < self.POLY_END_CLICK_RADIUS) {
              self.polyStarted = false;
              self.sendPoly = true;
            } else {
              var newPoint = new Point(Math.round(scaled_x_off), Math.round(scaled_y_off));

              curPoly[curPoly.length] = newPoint;
              self.metaData[self.metaData.length] = newPoint;
              if(curPoly.length >= self.POLY_MAX_POINTS) {
                self.polyStarted = false;
                self.sendPoly = true;
              }
            }

          }else{
            // start a polygon draw
            self.drawPolyBegin(scaled_x_off, scaled_y_off)
            self.sendPoly = false;
          }
          if (self.sendPoly){
            // Find the rectangle region of drawn polygon
            var curPoly = self.polygonPoints[self.polygonPoints.length-1]['points'];
            var maxX = Number.MIN_VALUE, maxY = Number.MIN_VALUE, minX = Number.MAX_VALUE, minY = Number.MAX_VALUE;
            for (var i = 0; i < curPoly.length; i++){
              var x = curPoly[i].x;
              var y = curPoly[i].y;
              maxX = x > maxX ? x : maxX;
              maxY = y > maxY ? y : maxY;
              minX = x < minX ? x : minX;
              minY = y < minY ? y : minY;
            }

            // For each point in the rectangle region, put into metaData if the point is inside the polygon.
            for (var r = minX; r <= maxX; r++){
              for(var c = minY; c <= maxY; c++){
                var curPoint = new Point(r, c);
                if (self.insidePoly(curPoint, curPoly)){
                  self.metaData[self.metaData.length] = curPoint;
                }
              }
            }

            // Send request
            self.drawPolygon(self.ctx);
            self.drawPolygon(self.nonscaledCtx);
            var info = self.constructRequest();
            var json = JSON.stringify(info);
            self.sendMask(json);
          }else{
            self.drawPolygon(self.ctx);
            self.drawPolygon(self.nonscaledCtx);
          }
          break;
        case 'Rectangle':
          if(self.bbox.isBox){
            self.clearRectFromCanvas();
          }
          self.drawRectBegin(x_off, y_off);
          break;
        }
    },
    handleMouseleave: function(e, canvas, historyFrame){
      e.preventDefault();
      var self = this;
      if (!self.mousePressed || !self.curTool){
        return;
      }
      if(self.curTool==='posPen' || self.curTool ==='negPen'){
        self.addHistory(self.curTool, 2);
      }
      // event coordinate
      var x_off = e.pageX - $(canvas).offset().left;
      var y_off = e.pageY - $(canvas).offset().top;

      switch (self.curTool) {
        case 'Polygon':
          break;
        case 'Rectangle':
          self.clearRectFromCanvas();
          self.updateRectEnd(x_off, y_off);
          self.drawRect(self.ctxP);
          if(self.bbox.start_x > self.bbox.end_x){
            [self.bbox.start_x, self.bbox.end_x] = [self.bbox.end_x, self.bbox.start_x]
          }
          if(self.bbox.start_y < self.bbox.end_y){
            [self.bbox.start_y, self.bbox.end_y] = [self.bbox.end_y, self.bbox.start_y]
          }
          break;
        case 'posPen':
          if (!self.checkSelectedHie()){
            return;
          }
          break;
        case 'negPen':
          if (!self.checkSelectedHie()){
            return;
          }
          break;
        default:
          alert('Error!');
          return;
      }

      self.mousePressed = false;
    },



    constructRequest: function(){
      var self = this;
      var color = self.hexToRgb(self.selectedHie.color);
      var obj = self.selectedHie.parent.name;
      var cls = self.selectedHie.name;
      var imgName = self.images[self.curImgID].name;
      imgName = imgName.substring(0, imgName.lastIndexOf('.'));

      // get image data
      var imgURL = 0;
      if(self.bbox.isBox){
        var bx0 = self.bbox.start_x;
        var bx1 = self.bbox.end_x;
        var by0 = self.bbox.start_y;
        var by1 = self.bbox.end_y;
        var imgData = self.nonscaledCtx.getImageData(bx0,by0,bx1,by1);
        var imgCanvas = $("<canvas>").attr("width", bx1-bx0).attr("height", by1-by0)[0];
        imgCanvas.getContext('2d').putImageData(imgData, 0, 0);
        imgURL = imgCanvas.toDataURL();
      }
      else{
        imgURL = self.canvasData;
      }

      var semURL = self.canvasDataSem;
      // construct sending information
      var info = {'fname': imgName,
                  'image': imgURL,
                  'sem': semURL,                
                  'prev': self.labelFinal,
                  'color': color,
                  'mode': self.curMode,
                  'obj': obj,
                  'cls': cls,
                  'tool': self.curTool,
                  'bbox':{  start_x: self.bbox.start_x,
                            start_y: self.bbox.start_y,
                            end_x: self.bbox.end_x,
                            end_y: self.bbox.end_y,
                         },
                  'pos': self.posPoints,
                  'neg': self.negPoints,
                 }
      return info;
    },

    contrastColor: function(hexcolor){
      var r = parseInt(hexcolor.substr(0,2),16);
      var g = parseInt(hexcolor.substr(2,2),16);
      var b = parseInt(hexcolor.substr(4,2),16);
      var yiq = ((r*299)+(g*587)+(b*114))/1000;

      var textcolor = (yiq >= 128) ? 'black' : 'white';
      return textcolor;
    },

    addAnnoClassToHiePanel: function(cls_name, cls_color){
        var self = this;

        var newClass = document.createElement('li');
        var newIn = document.createElement('input');
        newIn.setAttribute('type', 'checkbox');
        newIn.setAttribute('style', 'opacity=1.0;margin-right=0;display=inline-block;-webkit-appearance:checkbox');
        newIn.style.opacity='1.0';
        newIn.style.display='inline-block';
        newIn.addEventListener('change', self.selectClassOnHiePanel);
        newIn.setAttribute('id', cls_color);
        newIn.setAttribute('class', 'checkboxItem');
        newIn.setAttribute('name', cls_name);

        newClass.textContent = cls_name;
        newClass.insertBefore(newIn, newClass.childNodes[0]);
        self.$selectClasses.append(newClass);
    },

    //TODO: bugs to be fixed
    addAnnoClass: function(name, color, superItem, container, errorContainer, id=-1){
        var self = this;
        var stack = superItem? superItem.subClasses : self.classStack;
        var sclasses = new infoStack(self.stackType['class']);
        self.classUid = self.classUid + 1;
        var item = new AnnoClass((id<0? self.classUid:id), superItem, sclasses, color, name);

        // duplicate
        for (var i = 0; i < stack.getSize(); i++){
          var datum = stack.find(i);
          if (datum.name == item.name || datum.color == item.color){
            errorContainer.text('Duplicate Color or Class Name.');
            errorContainer.show();
            return false;
          }
        }

        // overflow
        errorContainer.hide();
        if(stack.add(item)===0){
          errorContainer.text('Reached maximum number, please remove useless name');
          errorContainer.show();
          return false;
        }else{
          // show in the classFrame
          if (superItem){
            var parent = container.tree('getNodeById', superItem.uid);
            container.tree('appendNode', {
              id: item.uid,
              name: item.name,
              color: item.color,
            }, parent);
            container.tree('openNode', parent);
          }else{
            container.tree('appendNode', {
              id: item.uid,
              name: item.name,
              color: item.color,
            });
          }

          // render css
          for(var i = 0; i < self.classStack.getSize(); i++){
            var datum = stack.find(i);
            var node = container.tree('getNodeById', datum.uid);
            node = node.element.firstChild.firstChild;
            node.style["color"] = "#"+datum.color;
            node.style["font-weight"] = "900";
            node.style["font-size"] = "130%";
          }

          if(self.selectedClass){
            $(self.selectedClass.element).children('div').addClass('highlight');
          }
          return true;
        }
    },

    addHierarchy: function(item, container, errorContainer, hierarchies, id=-1){
      var self = this;
      var root = container.tree('getTree');
      var nodes = root['children'];

      if (!item['name']){
        errorContainer.text('Please type a name');
        errorContainer.show();
        return;
      }

      for (var i = 0; i < nodes.length; i++){
        if (nodes[i].name === item['name']){
          errorContainer.text('Duplicate Hierarchy Name.');
          errorContainer.show();
          return;
        }
      }
      errorContainer.hide();

      //append
      self.hieUid = id<0? self.hieUid+1 : id;
      if(self.hieUid > 255){
          alert('Warning::hieUid for object-class list is over 255.');
      }
      item['id']  = self.hieUid;
      container.tree('prependNode',{
        name: item['name'],
        id: item['id'],
      });
      self.hierarchyStack.add(item);

      var option = $('<option value=' + item['id'].toString() +'>'+ item['name'] +'</option>');
      hierarchies.append(option);
    },

    renderHierarchyFrame: function(){
        var self  = this;
        for (var h = 0; h < self.hierarchyStack.getSize(); h++){
            var element = self.hierarchyStack.find(h);
            var node = self.$selectHieFrame.tree('getNodeById', element['id']);
            self.renderHieNode(node, self.$selectHieFrame);
        }
        if(self.selectedHie){
            $(self.selectedHie.element).children('div').addClass('highlight-class');
        }
    },

    renderHieNode: function(node){
        if(node['color']){
            console.log('Warning::no supoort for object-class node in renderHieNode function.');
            return;
        }
        var self = this;
        for (var i = 0; i < node.children.length; i++){
            self.renderHieSubNode(node.children[i]);
        }
    },

    renderHieSubNode: function(node){
        var self = this;
        // non object-class subNode
        if(!node['color']){
            alert('render CLASS node, not supoort OBJECT node');
            return;
        }

        // add color block
        var colorBlock = $('#hie' + node.id + '');
        colorBlock.css({
          'display': 'inline-block',
          'width': '20px',
          'height': '20px',
          'float': 'right',
          'margin-right': '20px',
          'background-color': '#' + node.color,
        });

        // render font for locked & processe
        var objName = node.parent.name;
        var clsName = node.name;
        var ele = self.$selectHieFrame.tree('getNodeById', node.id);
        ele = ele.element.firstChild.firstChild;

        if (self.labelWorking){
            var locked = self.labelWorking.locked;
            if(objName in locked && clsName in locked[objName] ){
                ele.style["color"]= locked[objName][clsName]? "#f00" : "#000";
            }else{
                ele.style["color"]="#000";
            }

            var pos = self.labelWorking.pos;
            if(objName in pos && clsName in pos[objName] ){
                ele.innerHTML = '*: ' + node.name;
            }else{
                ele.innerHTML = node.name;
            }
        }
    },

    addOneSubNode: function(pid, container, classInfo, uid=-1){
        var self = this;
        var node = container.tree('getNodeById', parseInt(pid));
        for (var i = 0; i < node.children.length; i++){
          if (node.children[i].name === classInfo.name){
            alert('Duplicates!');
            return;
          }
        }

        // add the subNode to the frame
        self.hieUid = uid<0? self.hieUid + 1: uid;
        if(self.hieUid > 255){
            alert('Warning::hieUid for object-class list is over 255.');
        }
        var classname = classInfo.name;
        var color = classInfo.color;
        container.tree('appendNode', {
          name: classname,
          color: color,
          id: self.hieUid,
        }, node);
        container.tree('openNode', node);
        self.renderHieNode(node);

        // find the parent node in hierarcy, add class into the hierarchy node
        var hie = null;
        for (var i = 0; i < self.hierarchyStack.getSize(); i++){
          if (self.hierarchyStack.find(i).id == pid){
            hie = self.hierarchyStack.find(i);
          }
        }
        var classes = hie['classes'];
        classes[classes.length] = {'name': classname, 'color': color, 'uid': self.hieUid};
    },

    checkSelectedHie: function(){
        var self = this;
        if(self.selectedHie && self.selectedHie['color']){
            return true;
        }else{
            return false;
        }
    },

    deleteClass: function(cstack, node){
        var self = this;
        var stack = [new AnnoClass(-1, null, cstack, null, null)];

        var cur, each, state;
        var children, len;
        while(cur = stack.pop()){
          children = cur.subClasses;
          for (var i = 0; i < children.getSize(); i++){
            var uid = children.find(i).uid;
            if (uid == node.id){
              state = children.delete(i);
              break;
            }
            each = self.$selectClassFrame.tree('getNodeById', uid);
            stack.push(children.find(i));
          }
        }
        if (state){
          self.$selectClassFrame.tree('removeNode', node);
        }else{
          alert("something wrong!");
          return;
        }
    },

    drawLineBegin: function(x, y, tool){
        var self = this;
        self.metaData = new Array();
        self.mousePressed = true;
        self.point.x = Math.round(x / self.scaleCanvas);
        self.point.y = Math.round(y / self.scaleCanvas);
        if(self.curTool == 'posPen'){
          self.posPoints.push(new Point(Math.round(x / self.scaleCanvas), Math.round(y / self.scaleCanvas)));
        }
        else if(self.curTool == 'negPen'){
          self.negPoints.push(new Point(Math.round(x / self.scaleCanvas), Math.round(y / self.scaleCanvas)));
        }
        else{
          self.metaData.push(new Point(Math.round(x / self.scaleCanvas), Math.round(y / self.scaleCanvas)));
        }
    },
    fitLineXFixed: function(start_x, start_y, end_x, end_y, ctx, store, correction){
      var self = this;
      // line equation: y-y1 = (y2-y1)/(x2-x1) * (x-x1) derived: (y1-y2) * x + (x2-x1) * y + (x1-x2)*y1 + (y2-y1)*x1 = 0
      var a = start_y - end_y;
      var b = end_x - start_x;
      var c = (start_x - end_x) * start_y + (end_y - start_y) * start_x;

      if(self.curTool == 'posPen'){
        var length = self.posPoints.length;
        // fit the line on X-axis
        for (var fix_x = Math.round(Math.min(start_x, end_x)) + 1; fix_x < Math.round(Math.max(start_x, end_x)); fix_x++){
          var cal_y = Math.round((- (c + a * fix_x) / b));
          var pointOnLine = new Point(fix_x, cal_y);
          ctx.fillRect(pointOnLine.x-correction, pointOnLine.y-correction, self.lineWidth, self.lineWidth);

          if (store && (pointOnLine.x != self.posPoints[length-1].x || pointOnLine.y != self.posPoints[length-1].y)){
            for (var xi = pointOnLine.x-correction; xi < pointOnLine.x-correction + self.lineWidth; xi++){
              for (var yi = pointOnLine.y-correction; yi < pointOnLine.y-correction + self.lineWidth; yi++){
                self.posPoints.push(new Point(xi, yi));
              }
            }
          }
        }
      }
      if(self.curTool == 'negPen'){
        var length = self.negPoints.length;
        // fit the line on X-axis
        for (var fix_x = Math.round(Math.min(start_x, end_x)) + 1; fix_x < Math.round(Math.max(start_x, end_x)); fix_x++){
          var cal_y = Math.round((- (c + a * fix_x) / b));
          var pointOnLine = new Point(fix_x, cal_y);
          ctx.fillRect(pointOnLine.x-correction, pointOnLine.y-correction, self.lineWidth, self.lineWidth);


          if (store && (pointOnLine.x != self.negPoints[length-1].x || pointOnLine.y != self.negPoints[length-1].y)){
            for (var xi = pointOnLine.x-correction; xi < pointOnLine.x-correction + self.lineWidth; xi++){
              for (var yi = pointOnLine.y-correction; yi < pointOnLine.y-correction + self.lineWidth; yi++){
                self.negPoints.push(new Point(xi, yi));
              }
            }
          }
        }
      }
    },
    fitLineYFixed: function(start_x, start_y, end_x, end_y, ctx, store, correction){
      var self = this;
      // line equation: y-y1 = (y2-y1)/(x2-x1) * (x-x1) derived: (y1-y2) * x + (x2-x1) * y + (x1-x2)*y1 + (y2-y1)*x1 = 0
      var a = start_y - end_y;
      var b = end_x - start_x;
      var c = (start_x - end_x) * start_y + (end_y - start_y) * start_x;

      if(self.curTool == 'posPen'){
        var length = self.posPoints.length;

        for (var fix_y = Math.round(Math.min(start_y, end_y)) + 1; fix_y < Math.round(Math.max(start_y, end_y)); fix_y++){
          var cal_x = Math.round((- (c + b * fix_y) / a));
          var pointOnLine = new Point(cal_x, fix_y);

          ctx.fillRect(pointOnLine.x-correction, pointOnLine.y-correction, self.lineWidth, self.lineWidth);

          if (store && (pointOnLine.x != self.posPoints[length-1].x || pointOnLine.y != self.posPoints[length-1].y)){
            for (var xi = pointOnLine.x-correction; xi < pointOnLine.x-correction + self.lineWidth; xi++){
              for (var yi = pointOnLine.y-correction; yi < pointOnLine.y-correction + self.lineWidth; yi++){
                self.posPoints.push(new Point(xi, yi));
              }
            }
          }
        }
      }

      if(self.curTool == 'negPoints'){
        var length = self.negPoints.length;

        for (var fix_y = Math.round(Math.min(start_y, end_y)) + 1; fix_y < Math.round(Math.max(start_y, end_y)); fix_y++){
          var cal_x = Math.round((- (c + b * fix_y) / a));
          var pointOnLine = new Point(cal_x, fix_y);

          ctx.fillRect(pointOnLine.x-correction, pointOnLine.y-correction, self.lineWidth, self.lineWidth);

          if (store && (pointOnLine.x != self.negPoints[length-1].x || pointOnLine.y != self.negPoints[length-1].y)){
            for (var xi = pointOnLine.x-correction; xi < pointOnLine.x-correction + self.lineWidth; xi++){
              for (var yi = pointOnLine.y-correction; yi < pointOnLine.y-correction + self.lineWidth; yi++){
                self.negPoints.push(new Point(xi, yi));
              }
            }
          }
        }
      }
    },


    drawLine: function(x, y){
      var self = this;
      if (Math.round(self.point.x) == Math.round(x) && Math.round(self.point.y) == Math.round(y)){
        return;
      }

      if(self.checkSelectedHie()){
        self.ctxP.beginPath();

        //may need to change colors to red and black or something to indicate positive and negative
        self.ctxP.strokeStyle = '#' + self.selectedHie.color.toString();
        self.ctxP.strokeStyle = '#' + self.selectedHie.color.toString();
        if(self.curTool == 'posPen'){
          self.ctxP.strokeStyle = "#000000";
        }
        if(self.curTool == 'negPen'){
          self.ctxP.strokeStyle = "#ff0000";
        }
        var rgb = self.hexToRgb(self.ctxP.strokeStyle);
        var round_x = Math.round(x);
        var round_y = Math.round(y);
        var scaled_end_x = Math.round(x / self.scaleCanvas);
        var scaled_end_y = Math.round(y / self.scaleCanvas);
        var scaled_start_x = Math.round(self.point.x);
        var scaled_start_y = Math.round(self.point.y);

        var r = rgb.r;
        var g = rgb.g;
        var b = rgb.b;
        var correction = Math.floor(self.lineWidth / 2);
        self.ctxP.fillStyle = "rgba("+r+","+g+","+b+","+(255/255)+")";
        self.ctxP.fillRect(scaled_end_x-correction, scaled_end_y-correction, self.lineWidth, self.lineWidth );

        self.fitLineXFixed(scaled_start_x, scaled_start_y, scaled_end_x, scaled_end_y, self.ctxP, true, correction);
        self.fitLineYFixed(scaled_start_x, scaled_start_y, scaled_end_x, scaled_end_y, self.ctxP, true, correction);

        self.point.x = scaled_end_x;
        self.point.y = scaled_end_y;

        if(self.curTool == 'posPen'){
          var length = self.posPoints.length;
          if (scaled_end_x != self.posPoints[length-1].x || scaled_end_y != self.posPoints[length-1].y){
            for (var start_x = scaled_end_x-correction; start_x < scaled_end_x-correction + self.lineWidth; start_x++){
              for (var start_y = scaled_end_y-correction; start_y < scaled_end_y-correction + self.lineWidth; start_y++){
                self.posPoints.push(new Point(start_x, start_y));
              }
            }
            self.posPoints.push(new Point(scaled_end_x, scaled_end_y));
          }
        }

        if(self.curTool == 'negPen'){
          var length = self.negPoints.length;
          if (scaled_end_x != self.negPoints[length-1].x || scaled_end_y != self.negPoints[length-1].y){
            for (var start_x = scaled_end_x-correction; start_x < scaled_end_x-correction + self.lineWidth; start_x++){
              for (var start_y = scaled_end_y-correction; start_y < scaled_end_y-correction + self.lineWidth; start_y++){
                self.negPoints.push(new Point(start_x, start_y));
              }
            }
            self.negPoints.push(new Point(scaled_end_x, scaled_end_y));
          }
        }
      }
    },

    // TODO: pixels inside polygon and put them into metaData
    drawPolyBegin: function(x, y){
      var self = this;
      var points = new Array();
      self.metaData = new Array();
      points[0] = new Point(Math.round(x), Math.round(y));
      self.metaData[0] = points[0]
      var item = {'points': points, 'color': self.selectedHie.color};
      self.polygonPoints[self.polygonPoints.length] = item;
      self.polyStarted = true;
    },

    drawPolygon: function(ctx){
        var self = this;
        if (!self.checkSelectedHie()){
          return;
        }
        ctx.fillStyle = "#000000";
        for (var k = 0; k < self.polygonPoints.length; k++){
          ctx.beginPath();
          var item = self.polygonPoints[k];
          var points = item['points'];
          var color = item['color'];
          ctx.strokeStyle = '#' + color.toString();
          ctx.lineWidth = self.lineWidth;

          if(points != null && points.length > 0) {
            ctx.moveTo(points[0].x, points[0].y);
            ctx.fillRect(points[0].x, points[0].y, 4, 4);

            for(var i = 1 ; i < points.length ; i++) {
              ctx.fillRect(points[i].x, points[i].y, 4, 4);
              ctx.lineTo(points[i].x, points[i].y);
            }

            if(!self.polyStarted) {
              ctx.lineTo(points[0].x, points[0].y);
            }
          }
          ctx.stroke();
        }
    },

    drawPosPoints: function(ctx){
        var self = this;
        if (!self.checkSelectedHie()){
          return;
        }
        ctx.fillStyle = "#000000";
        for(var k = 0; k <self.posPoints.length; k++){
          var point = self.posPoints[k];
          if(point !== null){
            ctx.fillRect(point.x, point.y,self.lineWidth,self.lineWidth);
          }
        }
    },

    drawNegPoints: function(ctx){
        var self = this;
        if (!self.checkSelectedHie()){
          return;
        }
        ctx.fillStyle = "#ff0000";
        for(var k = 0; k <self.negPoints.length; k++){
          var point = self.negPoints[k];
          if(point !== null){
            ctx.fillRect(point.x, point.y,self.lineWidth,self.lineWidth);
          }
        }
    },

    clearRectFromCanvas: function(){
        var self = this;
        self.ctxP.clearRect(0, 0, self.width, self.height);
        self.drawPosPoints(self.ctxP);
        self.drawNegPoints(self.ctxP);
    },

    drawRectBegin: function(x, y){
        var self = this;
        self.mousePressed = true;

        // clear line drawn for annotation if the user wants new bounding box
        // avoids out of bounds error in DLearning_PosNeg
        self.posPoints = new Array();
        self.negPoints = new Array();
        self.ctxP.clearRect(0,0,self.width,self.height);
        // clear the previous bounding box if there is any
        if (self.bbox.isBox){
          self.clearRectFromCanvas();
        }

        self.bbox.start_x = Math.round(x / self.scaleCanvas);
        self.bbox.start_y = Math.round(y / self.scaleCanvas);
        self.bbox.isBox = true;
    },

    updateRectEnd: function(x, y){
        var self = this;

        self.bbox.end_x = Math.round(x / self.scaleCanvas);
        self.bbox.end_y = Math.round(y / self.scaleCanvas);
    },

    drawRect: function(ctx){
        var self = this;

        // check if the box is valid
        if (self.bbox.isBox===false||(self.bbox.start_x===self.bbox.end_x &&
                                      self.bbox.start_y===self.bbox.end_y)){
          self.bbox.start_x = 0;
          self.bbox.end_x = self.width;
          self.bbox.start_y = 0;
          self.bbox.end_y = self.height;
          self.bbox.bboxData = null;
          self.bbox.isBox = false;
          return;
        }

        // draw rectangle
        var h = self.bbox.end_y - self.bbox.start_y;
        var w = self.bbox.end_x - self.bbox.start_x;
        var gradient=ctx.createLinearGradient(self.bbox.start_x,
                                              self.bbox.start_y,
                                              self.bbox.end_x,
                                              self.bbox.end_y);
        gradient.addColorStop("0","magenta");
        gradient.addColorStop("0.5","blue");
        gradient.addColorStop("1.0","red");

        ctx.lineWidth = Math.round(1/self.scaleCanvas)
        ctx.strokeStyle = gradient;
        ctx.strokeRect(self.bbox.start_x, self.bbox.start_y , w, h);
    },

    process_oneStep: function(historyFrame){
        var self = this;
        console.log("process button");

        document.body.style.cursor = 'wait';
        document.getElementById('perform').disabled = true;
        document.getElementById('perform').style.border = '1px dotted purple';

        self.labelFinal = self.classChange? JSON.parse(JSON.stringify(self.labelWorking)):self.labelFinal;
        self.classChange = false;
        var info = self.constructRequest();
        let proceed = true;
        var i = new Image(); 
        i.onload = function(){
          if(i.width > 512 && i.height > 512 && !self.bbox.isBox){
            proceed = confirm("Recommended: Use the rectangular selection to draw a bounding box around the object of interest. \n Press OK to proceed, and cancel to cancel the operation.");
          }
          if (proceed){
            var json = JSON.stringify(info);
            self.sendMask(json);
            // update node as processed
            self.renderHieNode(self.selectedHie.parent);
            $(self.selectedHie.element).children('div').addClass('highlight-class');
          }
          document.getElementById('perform').disabled = false;
          document.getElementById('perform').style.border = '2px solid green';
          document.body.style.cursor = 'default';
        }
        i.src = info.image; 
    },

    addHistory: function(action, type=0){
        var self  = this;

        // add to historyPanel
        var id     = self.historyStack.curIdx-1;
        var hisCell = $('<tr class="hisCell" id=' + id.toString() + '><td>' + action + '</td>'+
                    '<td><img src="' + self.canvasData  +'" style="width:' + self.thumbWidth + 'px;'+
                          'height:' + self.thumbHeight +'px;"></img></td></tr>');
        self.$historyFrame.append(hisCell);
        self.$historyFrame.scrollTop(self.$historyFrame[0].scrollHeight);

        // add to historyStack
        var item = null;
        if(type === 0){//action==='null'
            item = {tool:'null',
                    type: type,
                    labelFinal: self.labelFinal,
                    labelWorking: self.labelWorking,
                    posPoints: self.posPoints,
                    negPoints: self.negPoints};
        } else if(type ===1 ){ //action ==='Process' || action === 'erase' || 'import'
            item = {tool:action,
                    type: type,
                    selectHieId: self.selectedHie? self.selectedHie.id : 1,
                    labelFinal:  self.labelFinal,
                    labelWorking:self.labelWorking };
        }else{ // 2 for 'negPen' or 'posPen'
            item = {tool:action,
                    type: type,
                    selectHieId:self.selectedHie.id,
                    posPoints:Array.from(self.posPoints),
                    negPoints:Array.from(self.negPoints) };
        }

        var state = self.historyStack.add(item);
        if (state === 1){
          self.updateId(self.$historyFrame);
        }

        self.renderHierarchyFrame();
    },

    removeHistoryFrame: function(){
        var self = this;
        var $last = self.$historyFrame.find('tr:last');
        $last.remove();
    },

    updateHieHighlight: function(nodeId){
        var self = this;
        if(self.selectedHie){
            $(self.selectedHie.element).children('div').removeClass('highlight-class');
        }
        if(nodeId >= 0){
            self.selectedHie = self.$selectHieFrame.tree('getNodeById', nodeId);
            $(self.selectedHie.element).children('div').addClass('highlight-class');
        }
    },

    undoOnce: function(){
        var self = this;
        var rm_top = self.historyStack.peek();
        if(rm_top.tool=='null'){
            alert("undo stack is out of remembered historic actions.")
            return;
        }
        // remove one step and add to redo-stack
        self.historyRedoStack.add(rm_top);
        self.historyStack.delete(self.historyStack.curIdx-1);
        var $last = self.$historyFrame.find('tr:last');
        $last.remove();

        // update status
        var top = self.historyStack.peek();
        var selectId = null;
        if(top.tool==='null'){
            selectId = -1;
            self.labelFinal   = new Label();
            self.labelWorking = new Label();
            self.posPoints = new Array();
            self.negPoints = new Array();
        }else{
            // selectId = top.selectHieId;
            var pro_prev = self.historyStack.seekLatestByKey('type', 1)
            if(!pro_prev){
                self.labelFinal = new Label();
                self.labelWorking = new Label();
            }else{
                self.labelFinal = pro_prev.labelFinal;
                self.labelWorking = pro_prev.labelWorking;
            }
            var pen_prev = self.historyStack.seekLatestByKey('type', 2)
            if(!pen_prev){
                self.posPoints = new Array();
                self.negPoints = new Array();
            }else{
                self.posPoints = Array.from(pen_prev.posPoints);
                self.negPoints = Array.from(pen_prev.negPoints);
            }
        }

        // rendering
        // self.updateHieHighlight(selectId);
        self.renderDict(self.labelWorking, self.maskType);
        $('#label-img').attr('src', self.nonscaledCanvas.toDataURL());
        self.renderHierarchyFrame();
        self.ctxP.clearRect(0, 0, self.width, self.height);
        self.drawNegPoints(self.ctxP);
        self.drawPosPoints(self.ctxP);
        self.drawRect(self.ctxP);
    },

    redoOnce: function(){
        var self = this;
        if(self.historyRedoStack.curIdx == 0){
            alert("redo stack Empty!!!");
            return;
        }
        var top  = self.historyRedoStack.peek();
        self.historyRedoStack.delete(self.historyRedoStack.curIdx-1);
        var tmp_hie_id = -1
        if (self.selectedHie){
            tmp_hie_id = self.selectedHie.id
        }

        // render
        self.updateHieHighlight(top.selectHieId);
        if( top.type == 1){
            self.labelFinal   = top.labelFinal;
            self.labelWorking = top.labelWorking;
            self.renderDict(self.labelWorking, self.maskType);
            $('#label-img').attr('src', self.nonscaledCanvas.toDataURL());
            self.renderHierarchyFrame();
        }else{
            self.posPoints = Array.from(top.posPoints);
            self.negPoints = Array.from(top.negPoints);
            self.ctxP.clearRect(0, 0, self.width, self.height);
            self.drawNegPoints(self.ctxP);
            self.drawPosPoints(self.ctxP);
            self.drawRect(self.ctxP);
        }
        self.addHistory(top.tool, top.type);
        if (tmp_hie_id>0){
            self.updateHieHighlight(tmp_hie_id);
        }
    },

    updateId: function(history){
      history.find('#1').remove();
      history.find('tr').each(function(index){
        var newId = parseInt($(this).attr('id')) - 1;
        $(this).attr('id', newId.toString());
      });
    },

    renderURL: function(url, label){
      var self = this;
      var img = new Image();
      var canvas = self.canvas[0];

      $(img).load(function(){
        canvas.width = img.width;
        canvas.height = img.height;
        self.ctx.drawImage(img, 0, 0);
      });
      img.src = url;

      // TODO: show previous label in the label wrapper
      var labImg = $('#label-img');
      if (!label){
        labImg.attr('src', '');
      }else{
        labImg.attr('src', label);
      }
    },
    hexToRgb: function(hex) {
      var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      } : null;
    },
    sendAllXMLRequest: function(request, name){
      var self = this;
      $.ajax({
        url: '/xml_saver',
        data: request,
        type: 'POST',
        contentType: 'application/json',
        dataType: 'xml',
        success: function(response){
          var content = new XMLSerializer().serializeToString(response);
          var ending = '</annotator>';
          var content_without_ending = content.substring(0, content.indexOf(ending));

          var drawings = '<drawings>' + self.nonscaledCanvas.toDataURL() + '</drawings>';
          var image = '<canvasData>' + self.canvasData + '</canvasData>';
          var blob = new Blob([content_without_ending+drawings+image+ ending], {type: "text/xml;charset=utf-8"});
          saveAs(blob, name + ".xml");
        },
        error: function(xhr, ajaxOptions, thrownError){
          //ALI thrownError was too big for console, so I saved it to file instead
          var blob = new Blob([thrownError], {type: "text/plain;charset=utf-8"});
          saveAs(blob, "bug.xml");
          console.log("thrownError");
        },
      });
      return false;
    },
    sendConfigXMLRequest: function(request, name){
      var self = this;
      $.ajax({
        url: '/xml_saver',
        data: request,
        type: 'POST',
        contentType: 'application/json',
        dataType: 'xml',
        success: function(response){
          var content = new XMLSerializer().serializeToString(response);
          var ending = '</annotator>';
          var content_without_ending = content.substring(0, content.indexOf(ending));
          var blob = new Blob([content_without_ending + ending], {type: "text/xml;charset=utf-8"});
          saveAs(blob, name + ".xml");
        },
        error: function(xhr, ajaxOptions, thrownError){
          console.log("thrownError");
        },
      });
      return false;
    },

    sendLabelParse: function(imageURL){
        var self = this;
        // hierarchy panel to a dict
        var hierDict = {}
        for (var h =0; h < self.hierarchyStack.getSize(); h++){
            var element = self.hierarchyStack.find(h);
            var node = self.$selectHieFrame.tree('getNodeById', element['id']);
            var objName = node.name
            for (var i = 0; i < node.children.length; i++){
                var clsName = node.children[i].name
                var clsColor = self.hexToRgb(node.children[i].color);
                var uid = node.children[i].id
                hierDict[uid] = [objName, clsName, clsColor]
            }
        }
        var info = {'image': imageURL,
                    'prev': self.labelFinal,
                    'hier': hierDict,
        }

        // send to back-end to process
        $.ajax({
            url: '/label_parse',
            data: JSON.stringify(info),
            type: 'POST',
            contentType: 'application/json',
            success: function(response){
                self.labelWorking = response.label;
                self.labelFinal = JSON.parse(JSON.stringify(self.labelWorking));
                self.renderDict(self.labelWorking, self.maskType);
                self.renderHierarchyFrame();
                self.addHistory('import', 1);
                $('#label-img').attr('src', self.nonscaledCanvas.toDataURL());
	            document.getElementById('perform').disabled = false;
	            document.body.style.cursor = 'default';
            },
            error: function(xhr){
                var text = JSON.parse(xhr.responseText);
                alert(text['message']);
                // Restore states
                var top = self.historyStack.peek();
                var poly = top['poly'];
                self.polygonPoints = $.extend(true, [], poly);
                self.renderDict(self.labelWorking, self.maskType);
                $('#label-img').attr('src', self.nonscaledCanvas.toDataURL());
                document.getElementById('perform').disabled = false;
	            document.body.style.cursor = 'default';
            }
        })
    },

    sendMask: function(json){
      var self = this;

      $.ajax({
        url: '/handle_action',
        data: json,
        type: 'POST',
        contentType: "application/json",
        success: function(response){
          self.labelWorking = response.label;
          self.renderDict(self.labelWorking, self.maskType);
          self.addHistory("Process", 1);
          $('#label-img').attr('src', self.nonscaledCanvas.toDataURL());
	      document.getElementById('perform').disabled = false;
	      document.body.style.cursor = 'default';
        },
        error: function(xhr){
          var text = JSON.parse(xhr.responseText);
          alert(text['message']);
          // Restore states
          var top = self.historyStack.peek();
          var poly = top['poly'];
          self.polygonPoints = $.extend(true, [], poly);
          self.renderDict(self.labelWorking, self.maskType);
          $('#label-img').attr('src', self.nonscaledCanvas.toDataURL());
          document.getElementById('perform').disabled = false;
	      document.body.style.cursor = 'default';
	    }
      });

    },
    // For checking if a point is inside the polygon
    insidePoly: function(point, poly){
      var x = point.x, y = point.y;
      var inside = false;
      for (var i = 0, j = poly.length - 1; i < poly.length; j = i++){
        var xi = poly[i].x, yi = poly[i].y;
        var xj = poly[j].x, yj = poly[j].y;

        var intersect = ((yi > y) != (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
      }
      return inside;
    },

    findHieNode: function(objName){
      var self = this;
      var root = self.$selectHieFrame.tree('getTree');
      for (var i = 0; i < root.children.length; i++){
        if (root.children[i].name === objName){
            return root.children[i].id;
        }
      }
      return 0;
    },

    findHieSubNode: function(objName, clsName){
      var self = this;
      var root = self.$selectHieFrame.tree('getTree');
      for (var i = 0; i < root.children.length; i++){
        if (root.children[i].name !== objName){
            continue;
        }
        var node = root.children[i];
        for(var j = 0; j < node.children.length; j++){
            if(node.children[j].name === clsName){
                return node.children[j].id;
            }
        }
      }
      return 0;
    },

    gray2color: function(val){
      var k = val;
      var color = {'r':0, 'g':0, 'b':0};
      for(var j=0; j<8; j++){
          color.r |= ((k&1)>>0) << (7-j)
          color.g |= ((k&2)>>1) << (7-j)
          color.b |= ((k&4)>>2) << (7-j)
          k = (k>>3);
      }
      return color;
    },

    renderMask: function(dict, maskType){
      var self = this;

      var pos = dict.pos;
      var newImage = self.nonscaledCtx.createImageData(self.width, self.height);
      for (var objName in pos){
        var obj = pos[objName];
        for (var clsname in obj){
          var cls = obj[clsname]
          var coords = cls['coords'];
          var color = null;
          if(maskType==='class in rgb'){
            color = cls['color'];
          }else if(maskType==='object in rgb'){
            var objId = self.findHieNode(objName);
            color = self.gray2color(objId);
          }else if(maskType==='object-class in rgb'){
            var objId = self.findHieSubNode(objName, clsname);
            color = self.gray2color(objId);
          }else{ // 'object-class in gray'
            var objId = self.findHieSubNode(objName, clsname);
            color = {'r':objId, 'g':objId, 'b':objId};
          }

          for (var i = 0; i < coords.length; i++){
            var coord = coords[i];
            var index = (coord.x + coord.y * self.width) * 4;
            newImage.data[index] = color.r;
            newImage.data[index + 1] = color.g;
            newImage.data[index + 2] = color.b;
            newImage.data[index + 3] = 255;
          }
        }
      }

      var copiedCanvas = $('<canvas>').attr({
        width: self.width,
        height: self.height,
      })[0];
      copiedCanvas.getContext("2d").putImageData(newImage, 0, 0);
      var url = copiedCanvas.toDataURL();
      return url;
    },

    renderDict: function(dict, maskType){
      if(dict == null){
        return;
      }
      var self = this;
      var newImage = self.nonscaledCtxM.createImageData(self.width, self.height);
      var pixels = self.maskCanvasData.data;

      // object mask
      var pos = dict.pos;
      for (var objName in pos){
        var obj = pos[objName];
        for (var clsname in obj){
          var cls = obj[clsname]
          var coords = cls['coords'];
          var color = null;
          if(maskType === 'class in rgb'){
            color = cls['color'];
          }else if(maskType==='object in rgb'){
            var objId = self.findHieNode(objName);
            color = self.gray2color(objId);
          }else{ // object-class in rgb
            var objId = self.findHieSubNode(objName, clsname);
            color = self.gray2color(objId);
          }
          for (var i = 0; i < coords.length; i++){
            var coord = coords[i];
            var index = (Math.round(coord.x) + (Math.round(coord.y) * self.width)) * 4;
            newImage.data[index]     = color.r * 0.5 + pixels[index] * 0.5;
            newImage.data[index + 1] = color.g * 0.5 + pixels[index + 1] * 0.5;
            newImage.data[index + 2] = color.b * 0.5 + pixels[index + 2] * 0.5;
            newImage.data[index + 3] = 255;
          }
        }
      }

      // object edge
      var edge = dict.edge;
      for (var objName in edge){
        var obj_edge = edge[objName];
        for (var clsname_edge in obj_edge){
          var cls_edge = obj_edge[clsname_edge];
          for (var i = 0; i < cls_edge.length; i++){
            var coord_edge = cls_edge[i];
            var index_edge = (coord_edge.x + coord_edge.y * self.width) * 4;
            newImage.data[index_edge] = 255;
            newImage.data[index_edge + 1] = 255;
            newImage.data[index_edge + 2] = 255;
            newImage.data[index_edge + 3] = 255;
          }
        }
      }

      var copiedCanvas = $('<canvas>').attr({
        width: self.width,
        height: self.height,
      })[0];
      copiedCanvas.getContext("2d").putImageData(newImage, 0, 0);
      self.nonscaledCtxM.putImageData(copiedCanvas.getContext("2d").getImageData(0, 0, self.width, self.height), 0, 0);
      self.ctxM.clearRect(0, 0, self.width, self.height);
      self.ctxM.drawImage(self.nonscaledCtxM.canvas, 0, 0);

      var url = copiedCanvas.toDataURL();
      return url;
    },

    decodeAllTXT: function(dict){
        var self = this;

        // initial state
        self.bbox = { bboxData: null,
                     isBox: false,
                     start_x: 0,
                     start_y: 0,
                     end_x: self.width,
                     end_y: self.height, };

        // loading environment
        // class panel
        self.classStack = new infoStack(self.stackType['class'], self.maxsize_classStack);
        self.decodeClassTXT(dict.classStack, null);

        // hierarchy panel
        self.hierarchyStack = new infoStack(self.stackType['class'], self.maxsize_hierarchyStack);
        self.decodeHierarchyTXT(dict.hierarchyStack)
        if(self.hierarchyStack.getSize() > 0){
            self.updateHieHighlight(1);
        }

        // history panel and ctxM, ctxP
        self.historyStack = new infoStack(self.stackType['history'], self.maxsize_historyStack);
        self.historyStack.add({tool:'null'});
        self.decodeHistoryTXT(dict.historyStack);


        // render the canvas
        self.renderDict(self.labelWorking, self.maskType);
        self.ctxP.clearRect(0, 0, self.width, self.height);
        self.drawPosPoints(self.ctxP);
        self.drawNegPoints(self.ctxP);
    },

    decodeAllXML: function(xml){
        var self = this;
        self.decodeConfigXML(xml)

        var labelContent = xml.find('label');
        self.decodeLabelXML(labelContent)
        self.renderDict(self.labelWorking, self.maskType);
    },


    decodeConfigXML: function(xml){
        var self = this;

        var classContent = xml.find('classStack');
        var objectContent = xml.find('hierarchyStack');

        $('#clearHis').click();
        self.classStack = new infoStack(self.stackType['class'], self.maxsize_classStack);
        self.decodeClassXML(classContent, null);

        self.hierarchyStack = new infoStack(self.stackType['class'],
                                            self.maxsize_hierarchyStack);
        self.decodeHierarchyXML(objectContent);
        if(self.hierarchyStack.getSize() > 0){
            self.updateHieHighlight(1);
        }

        self.historyStack = new infoStack(self.stackType['history'],
                                          self.maxsize_historyStack);
        self.historyStack.add({tool:'null'});
        self.polygonPoints = new Array();
        self.posPoints = new Array();
        self.negPoints = new Array();
        self.labelFinal = new Label();
        self.labelWorking = new Label();
        self.nonscaledCtxM.clearRect(0, 0, self.nonscaledCtxM.canvas.width,
                                            self.nonscaledCtxM.canvas.height);
    },

    decodeLabelXML: function(label){
        var self = this;

        var edges = label.children('edge');
        var pos = label.children('pos');
        var num = label.children('numobj').text();

        self.labelWorking = new Label();
        self.labelWorking.numObj = parseInt(num);

        edges.children().each(function(){
          var classes = $(this).children();
          var name = $(this).prop("tagName");
          var objname = name.split('__')[0];

          (self.labelWorking.edge)[objname] = {};
          var itemEdge = (self.labelWorking.edge)[objname];

          (self.labelWorking.locked)[objname] = {};
          var itemLock = (self.labelWorking.locked)[objname];

          classes.each(function(){
            var arr = $(this).children();
            var clsname = $(this).prop("tagName");

            var coords = new Array();
            arr.each(function(){
              var x = parseInt($(this).children('x').text());
              var y = parseInt($(this).children('y').text());
              var coord = {'x': x, 'y': y};
              coords[coords.length] = coord;
            });

            itemEdge[clsname] = coords;
            itemLock[clsname] = false;
          });
        });

        pos.children().each(function(){
          var classes = $(this).children();
          var name = $(this).prop("tagName");
          var objname = name.split('__')[0];

          (self.labelWorking.pos)[objname] = {};
          var itemPos = (self.labelWorking.pos)[objname];

          classes.each(function(){
            var color = $(this).children('color');
            var coords = $(this).children('coords');
            var clsname = $(this).prop("tagName");

            var colorRGB = {};
            color.children().each(function(){
              var valueName = $(this).prop("tagName");
              colorRGB[valueName] = parseInt($(this).text());
            });

            var arr = new Array();
            coords.children().each(function(){
              var x = parseInt($(this).children('x').text());
              var y = parseInt($(this).children('y').text());
              var coord = {'x': x, 'y': y};
              arr[arr.length] = coord;
            });
            itemPos[clsname] = {'color': colorRGB, 'coords': arr};
          });
        });

        self.labelFinal = JSON.parse(JSON.stringify(self.labelWorking));
    },


    decodeHierarchyXML: function(obj){
      var self = this;
      var container = self.$selectHieFrame;
      var errorHieMsg  = self.$errorHieMsg;
      var hieOptions   = self.$hieOptions;
      if (obj.text() === '[]'){
        return;
      }

      obj.children().each(function(i, e){
        var obj_item = {'name': $(this).children('name').text(), 'classes': new Array()}
        self.addHierarchy(obj_item, container, errorHieMsg, hieOptions);

        if ($(this).children('classes').text() === '[]'){
          return;
        }
        var classes = $(this).children('classes');
        classes.children().each(function(){
          var clsName = $(this).children('name').text();
          var color = $(this).children('color').text();
          var uid = parseInt($(this).children('uid').text());

          var classInf = new ClassInfo(clsName, color);
          self.addOneSubNode(obj_item.id, container, classInf, uid);

        });
      });
      self.renderHierarchyFrame();
    },

    decodeHierarchyTXT: function(hier){
        var self = this;

        for(var i=0; i < hier.length; i++){
            var item = hier[i];
            var hieItem = {'name': item.name, 'classes': new Array()};
            self.addHierarchy(hieItem,
                              self.$selectHieFrame,
                              self.$errorHieMsg,
                              self.$hieOptions,
                              item.id);
            if(item['classes']){
                for(var j=0; j < item.classes.length; j++){
                    var sitem = item.classes[j];
                    var classInfo = new ClassInfo(sitem.name, sitem.color);
                    self.addOneSubNode(hieItem.id, self.$selectHieFrame, classInfo, sitem.uid);
                }
            }
        }
        self.renderHierarchyFrame();
    },

    decodeClassXML: function(classes, superClass){
      var self = this;

      if (classes.text() === '[]'){
        return;
      }

      classes.children().each(function(i, e){
        var pickedColor = $(this).children('color').text();
        var enteredName = $(this).children('name').text();

        var added = self.addAnnoClass(enteredName, pickedColor, superClass, self.$selectClassFrame, self.$errorMsg);
        if(added){
          self.addAnnoClassToHiePanel(enteredName, pickedColor)
        }

        // decode subClass if exists
        var node = self.$selectClassFrame.tree('getNodeById', self.classUid);
        self.decodeClassXML($(this).children('subClasses').children('data'), node);
      });
    },

    decodeClassTXT: function(classes, superClass){
        var self = this;

        for(var i=0; i < classes.length; i++){
            var item = classes[i];
            var added = self.addAnnoClass(item.name, item.color, null,
                                          self.$selectClassFrame, self.$errorMsg, self.uid);
            if (added){
                self.addAnnoClassToHiePanel(item.name, item.color);
            }
        }
    },

    decodeHistoryTXT: function(history){
        var self = this;
        for(var i=0; i < history.data.length; i++){
            var item = history.data[i];
            if(item.tool !== 'null'){
                if(self.selectedHie && self.selectedHie.id !== item.selectHieId){
                    self.posPoints = new Array();
                    self.negPoints = new Array();
                }

                if(item.type===2){// 'posPen' || 'negPen'
                    self.posPoints = item.posPoints;
                    self.negPoints = item.negPoints;
                }
                if(item.type===1){// 'Process' || 'erase'
                    self.labelFinal = item.labelFinal;
                    self.labelWorking = item.labelWorking;
                }

                // rendering
                if(!self.selectedHie || (self.selectedHie && self.selectedHie.id !== item.selectHieId)){
                    self.updateHieHighlight(item.selectHieId);
                }
                self.addHistory(item.tool, item.type);
            }
        }
    },
  }


  $.fn.annotator = function(wrapperCanvas, pointCanvas, maskCanvas, semCanvas, imgURL, wrapperCanvasCtx, pointCtx, maskCtx, semCtx, images){
    var annotator = new Annotator(wrapperCanvas, pointCanvas, maskCanvas, semCanvas, imgURL, wrapperCanvasCtx, pointCtx, maskCtx, semCtx, images);

    //var mousetrap = new Mousetrap(annotator)
    Mousetrap.bind({
      'a': function(e){console.log('press a, do zoomin'); $("#zoomin").click();},
      'd': function(e){console.log('press d, do zoomout'); $("#zoomout").click();},

      'space': function(e){console.log('press space, prcess'); $("#perform").click();},

      'w': function(e){console.log('press w, do undo'); $("#undoHis").click();},
      's': function(e){console.log('press s, do redo'); $("#redoHis").click();},

      'ctrl+s': function(e){console.log('press s, saving out...'); $("#file-controler-item").click();},

      'f': function(e){console.log('press f, select posPen'); $(".toolkit-item:contains('posPen')").click();},
      'g': function(e){console.log('press g, select negPen'); $(".toolkit-item:contains('negPen')").click();},

    });
  }
})(jQuery);
