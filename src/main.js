/* Punto de entrada: espera a la fuente pixel y arranca Phaser. */
function arrancar() {
    TouchControls.init([
        { name: 'left', label: '◀', side: 'left', aria: 'Left' },
        { name: 'down', label: '▼', side: 'left', aria: 'Down' },
        { name: 'right', label: '▶', side: 'left', aria: 'Right' },
        { name: 'magia', label: '✦', side: 'right', aria: 'Magic' },
        { name: 'attack', label: '⚔', side: 'right', aria: 'Attack' },
        { name: 'up', label: '▲', side: 'right', aria: 'Jump' },
    ]);
    window.juego = new Phaser.Game({
        type: Phaser.AUTO,
        width: ANCHO,
        height: ALTO,
        parent: 'juego',
        backgroundColor: '#0d1020',
        pixelArt: true,
        roundPixels: true,
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
        physics: { default: 'arcade', arcade: { gravity: { y: FISICA.gravedad }, debug: new URLSearchParams(location.search).has('debug'), tileBias: 24 } },
        input: { activePointers: 3 },
        scene: [Arranque, Menu, Juego, HUD, Pausa, Resumen, Final],
    });
}

const fuente = new FontFace('Pixelify', 'url(fuente/PixelifySans.ttf)');
fuente.load()
    .then((f) => { document.fonts.add(f); arrancar(); })
    .catch(arrancar);
