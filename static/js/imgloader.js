(function($){
  'use strict';
  /**
     * Function to load the image
     * @param {DOM} ele      [Can be any droppable DOM elements]
  */
  function ImgLoader(ele){
    this.$ele = $(ele);
    this.firstImg = null;
    this.$dragMsg = null;
    this.$chooseMsg = null;
    this.$msgBlock = null;
    this.$fileSelect = null;
    this.$imgCanvas = null;
    this.$pointCanvas = null;
    this.fullData = null;
    this.ctx = null;
    this.pointCtx = null;
    this.maskCtx = null;
    this.semCtx = null;
    this.init();
  }
/* methods prototype of Imgloader */
  ImgLoader.prototype = {
    init: function(){
      // console.log("jQuery "+ (jQuery ? $().jquery : "NOT") +" loaded")
      // Avoid conflit with this key word inside a binding event.
      var self = this;
      console.log("Calling image loader");

      self.$msgBlock = $('<div id = "showMsg"></div>');
      self.$dragMsg = $('<span id = "dragMsg" class = "theMsg">Drag your image to this block</span>');
      self.$chooseMsg = $('<span id = "chooseMsg" class = "theMsg">Click here to upload your image</span>');
      self.$fileSelect = $('<input id = "choose_img" type = "file" name = "mypics[]" multiple>');
      self.$imgCanvas = $('<canvas id = "imgCanvas"></canvas>');
      self.$pointCanvas = $('<canvas> id = "pointCanvas"></canvas>');
      self.$semCanvas = $('<canvas> id = "semCanvas"></canvas>');
      self.$maskCanvas = $('<canvas> id = "maskCanvas"></canvas>');

      self.$chooseMsg.append(self.$fileSelect);
      self.$msgBlock.append(self.$dragMsg);
      self.$msgBlock.append(self.$chooseMsg);
      self.$ele.append(self.$msgBlock);

      self.$fileSelect.on('change', function(e){        
        self.fullData = this.files;
        self.reader(this.files);
      });


      self.$msgBlock.on({
        mouseenter: function(e){
          e.preventDefault();
          self.$chooseMsg.stop().animate({"top":"0"},500);
          self.$dragMsg.stop().animate({"top":"100px"},500);
        },
        mouseleave: function(e){
          e.preventDefault();
          self.$chooseMsg.stop().animate({"top":"-100px"},500);
          self.$dragMsg.stop().animate({"top":"0"},500);
        },
      });
      self.$ele.on({

          dragleave: function(e){
            e.preventDefault();
            self.animations('black');
          },
          drop: function(e){
            e.preventDefault();

            // Get data that is dropped.
            e.dataTransfer = e.originalEvent.dataTransfer;
            var data = e.dataTransfer.files || e.target.files;

            if (data.length == 0){
              return;
            }

            if (self.typeChecks(data)){
              self.fullData = data;
              self.reader(data);
            }
          },
          dragenter: function(e){
            e.preventDefault();
            self.animations('orange');
          },
          dragover: function(e){
            e.preventDefault();
            self.animations('orange');
          }
      });
    },

    typeChecks: function(files){
      var self = this;
      for (var i = 0; i < files.length; i++){
        var file = files[i];
        var mimeType = file.type;
        if (mimeType.indexOf('image') == -1){
          alert("Type error: One or more files are not image type!");
          self.animations('black');
          return false;
        }
      }
      return true;

    },
    reader: function(allImg){
      var self = this;

      var reader = new FileReader();
      // After reader got loaded, save data into firstImg properties.
      $(reader).load(function(e){       
        self.firstImg = e.target.result;
        self.render();
        self.hideWrapper();
      });      
      reader.readAsDataURL(allImg[0])

    },
    render: function(){
      var self = this;
      var maxWidth = 700, maxHeight = 700;
      // Remove existed canvas
      // self.$ele.prev().find('#imgCanvas').remove();

      var img = new Image();
      var w, h, nw, nh, ratio;
      img.src = self.firstImg;
      $(img).load(function(e){
        w = this.width;
        h = this.height;


        // TODO: Comment out
        // console.log(nh,nw);
        // nh = 700;
        // nw = 700;
        // insert canvas before the drag drop element;
        self.$imgCanvas.insertBefore(self.$ele);
        //self.$pointCanvas.insertBefore(self.$ele);
        // get context
        self.ctx = self.$imgCanvas[0].getContext('2d');
        self.pointCtx = self.$pointCanvas[0].getContext('2d');
        self.maskCtx = self.$maskCanvas[0].getContext('2d');
        self.semCtx = self.$semCanvas[0].getContext('2d');
        // self.ctx2 = self.$imgCanvas[1].getContext('2d');


        self.$imgCanvas.attr({
          width: w,
          height: h,
        }).css({
          'display': 'block',
          'position': 'absolute',
          'top': '0',
          'left': '0',
          'margin': '0 auto',
          'z-index': '1',

          // "box-shadow": "0px 0px 5px 7px #AFAFAF",
        });

        self.$pointCanvas.attr({
          width: w,
          height: h,
        }).css({
          'display': 'block',
          'position': 'absolute',
          'top': '0',
          'left': '0',
          'margin': '0 auto',
          'z-index': '3',
          'opacity': 0.7,

          // "box-shadow": "0px 0px 5px 7px #AFAFAF",
        });

        self.$maskCanvas.attr({
          width: w,
          height: h,
        }).css({
          'display': 'block',
          'position': 'absolute',
          'top': '0',
          'left': '0',
          'margin': '0 auto',
          'z-index': '2',
          'opacity': 0.4,

          // "box-shadow": "0px 0px 5px 7px #AFAFAF",
        });

        self.$semCanvas.attr({
          width: w,
          height: h,
        }).css({
          'display': 'block',
          'position': 'absolute',
          'top': '0',
          'left': '0',
          'margin': '0 auto',
          'z-index': '4',
          'opacity': 0.4,
          // "box-shadow": "0px 0px 5px 7px #AFAFAF",
        });


        self.ctx.drawImage(img, 0, 0, w, h);
        //self.pointCtx.drawImage(img, 0, 0, w, h);
        //self.pointCtx.fillstyle = 'rgba: 0, 0, 200, 0.5';
        //self.pointCtx.drawRect(0, 0, w, h);

        var wrapperDiv = $('<div id = "wrapperDiv" class = "wrapperD mainoptionele"></div>');
        wrapperDiv.css({'background-color':'#000000',
            'width': '100%',
            'height': '600px',
            'border-radius':20,
            'display' : 'inline-block',
            'position': 'relative',
            'margin': '0 auto',
            'overflow': 'auto',
            'z-index': '0',
        });

        self.$imgCanvas.wrap(wrapperDiv);
        $('#wrapperDiv').append(self.$pointCanvas);
        $('#wrapperDiv').append(self.$maskCanvas);
        // $('#wrapperDiv').append(self.$semCanvas);


        var fileArr = Array.prototype.slice.call(self.fullData);        
        self.$ele.annotator(self.$imgCanvas, self.$pointCanvas, self.$maskCanvas, self.$semCanvas, self.firstImg, self.ctx, self.pointCtx, self.maskCtx, self.semCtx, fileArr);
      });


    },
    animations: function(color){
      this.$ele.css('background-color', color);
    },
    hideWrapper: function(){
      this.$ele.hide();
      this.$ele.prev().hide();
    },
    exposeWrapper: function(){
      this.$ele.show();
    },

  };

  $.fn.imgLoader = function(){
    var loader = new ImgLoader($(this));
  };


})(jQuery)
