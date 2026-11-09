/* =====================================================================
   Controles táctiles para los juegos de Phaser.
   Dibuja botones en pantalla que imitan las flechas y la barra espaciadora.
   Solo aparecen en pantallas táctiles.

   Uso desde el juego:
     TouchControls.init([{ name: 'left', label: '◀', side: 'left' }, ...]);
     TouchControls.state.left      → true mientras se mantiene pulsado
     TouchControls.consume('up')   → true una sola vez por pulsación
   ===================================================================== */
(function () {
    var state = {};
    var pending = {};

    var isTouch = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

    var css =
        '.tc-pad{position:fixed;bottom:max(16px,env(safe-area-inset-bottom));display:flex;gap:14px;z-index:10;pointer-events:none}' +
        '.tc-pad.left{left:16px}.tc-pad.right{right:16px}' +
        '.tc-btn{pointer-events:auto;width:68px;height:68px;border-radius:50%;border:2px solid rgba(255,255,255,.55);' +
        'background:rgba(0,0,0,.35);color:#fff;font:700 26px/1 system-ui,sans-serif;display:flex;align-items:center;' +
        'justify-content:center;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent}' +
        '.tc-btn.on{background:rgba(255,255,255,.35)}';

    function press(name, el) {
        if (!state[name]) pending[name] = true;
        state[name] = true;
        el.classList.add('on');
    }

    function release(name, el) {
        state[name] = false;
        el.classList.remove('on');
    }

    function makeButton(btn) {
        var el = document.createElement('button');
        el.className = 'tc-btn';
        el.type = 'button';
        el.textContent = btn.label;
        el.setAttribute('aria-label', btn.aria || btn.name);
        state[btn.name] = false;
        el.addEventListener('pointerdown', function (e) {
            e.preventDefault();
            el.setPointerCapture(e.pointerId);
            press(btn.name, el);
        });
        ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (type) {
            el.addEventListener(type, function () { release(btn.name, el); });
        });
        el.addEventListener('contextmenu', function (e) { e.preventDefault(); });
        return el;
    }

    window.TouchControls = {
        enabled: isTouch,
        state: state,

        consume: function (name) {
            if (!pending[name]) return false;
            pending[name] = false;
            return true;
        },

        init: function (buttons) {
            if (!isTouch) return;
            var style = document.createElement('style');
            style.textContent = css;
            document.head.appendChild(style);
            var pads = {};
            buttons.forEach(function (btn) {
                var side = btn.side || 'left';
                if (!pads[side]) {
                    pads[side] = document.createElement('div');
                    pads[side].className = 'tc-pad ' + side;
                    document.body.appendChild(pads[side]);
                }
                pads[side].appendChild(makeButton(btn));
            });
        }
    };
})();
