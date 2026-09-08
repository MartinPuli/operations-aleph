/* A single brand stage, using the same approved metal and narration clock. */
(function(global){
  'use strict';
  global.createWardenEndScene=function({canvas,logoCanvas,logoFilm,width=1920,height=1080}){
    canvas.width=width;canvas.height=height;
    const c=canvas.getContext('2d');
    function renderAt(seconds){
      const t=Number.isFinite(seconds)?seconds:24.1;
      c.setTransform(width/1920,0,0,height/1080,0,0);c.globalAlpha=1;c.filter='none';
      c.fillStyle='#081119';c.fillRect(0,0,1920,1080);
      logoFilm.renderAt(t);c.drawImage(logoCanvas,0,0,1920,1080);
    }
    return {renderAt};
  };
})(window);
