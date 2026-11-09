/* Los tres niveles, descritos en casillas de 16 px (x de izquierda a derecha, y de arriba
   abajo; el suelo normal está en la fila 28). El motor (juego.js) los construye.

   tramos:      [x0, x1, fila]        suelo macizo desde la fila hasta abajo
   bloques:     [x, fila, ancho, alto] islas flotantes macizas
   plataformas: [x, fila, tipo]       se atraviesan desde abajo (tronco 3 casillas, rama 5, losa 3)
   moviles:     [x, fila, tipo, dx, dy, periodo]  plataformas que van y vienen
   caen:        [x, fila]             losas que se hunden al pisarlas
   agua:        [x0, x1]              charcas entre tramos
   pinchos:     [x, fila, n]
   setas:       [x, fila]             setas gigantes que hacen rebotar
   enemigos:    [tipo, x, fila]
   colmenas:    [x, fila, abejas]
   objetos:     [tipo, x, fila]       pluma, orbe, escudo, pocion
   controles:   [x, fila]             banderas de control
   pistas:      [x, clave]            consejos que aparecen al pasar
*/
const TILE = 16;

/** Monedas en fila horizontal. */
function fila(x, y, n, paso = 2) {
    return Array.from({ length: n }, (_, i) => [x + i * paso, y]);
}

/** Monedas en arco (para saltos y precipicios). */
function arco(x, y, n, alto = 3) {
    return Array.from({ length: n }, (_, i) => [x + i * 1.5, y - alto * Math.sin((Math.PI * i) / Math.max(1, n - 1))]);
}

const NIVELES = [
    {
        clave: 'verde', musica: 'verde', ancho: 300, suelo: 'h',
        cielo: { tinte: 0xffffff, lejos: 0xffffff, cerca: 0xe8f4ec, pinosLejos: 0x6b9384, pinosCerca: 0x9cc7a6, fondo: '#8fd3e8' },
        arboles: ['verde', 'verde', 'amarillo'], ambiente: 'hojas',
        inicio: [4, 28],
        tramos: [[0, 44, 28], [44, 58, 25], [58, 76, 28], [83, 104, 28], [104, 118, 24], [118, 138, 28], [150, 170, 28],
                 [170, 186, 20], [186, 200, 22], [200, 228, 28], [240, 268, 28], [268, 300, 26]],
        bloques: [],
        plataformas: [[20, 24, 'tronco'], [26, 21, 'tronco'], [64, 23, 'rama'], [78, 25, 'tronco'], [92, 24, 'tronco'], [97, 21, 'tronco'],
                      [124, 23, 'rama'], [130, 19, 'tronco'], [140, 25, 'tronco'], [145, 23, 'tronco'], [176, 15, 'tronco'],
                      [206, 23, 'rama'], [214, 20, 'tronco'], [231, 24, 'rama'], [250, 23, 'tronco'], [256, 20, 'rama'],
                      [262, 17, 'tronco'], [280, 22, 'tronco']],
        moviles: [], caen: [], agua: [], pinchos: [],
        setas: [[121, 28], [224, 28]],
        monedas: [...fila(5, 26, 4), ...fila(20, 22, 3, 1), ...fila(26, 19, 3, 1), ...fila(46, 23, 5), ...arco(75, 24, 6),
                  ...fila(92, 22, 3, 1), ...fila(97, 19, 3, 1), ...fila(105, 22, 6), ...fila(119, 14, 5, 1), ...fila(119, 12, 5, 1),
                  ...fila(130, 17, 3, 1), ...arco(139, 22, 8), ...fila(152, 26, 4), ...fila(176, 13, 3, 1), ...fila(171, 18, 6),
                  ...fila(188, 20, 5), ...fila(206, 21, 5, 1), ...fila(214, 18, 3, 1), ...arco(227, 22, 8), ...fila(244, 26, 6),
                  ...fila(256, 18, 4, 1), ...fila(262, 15, 3, 1), ...fila(270, 24, 8), ...fila(280, 20, 3, 1)],
        enemigos: [['caracol', 16, 28], ['slime_verde', 36, 28], ['caracol', 50, 25], ['slime_verde', 66, 28], ['caracol', 72, 28],
                   ['slime_verde', 88, 28], ['slime_verde', 96, 28], ['caracol', 110, 24], ['slime_verde', 128, 28], ['caracol', 134, 28],
                   ['slime_verde', 156, 28], ['murcielago', 178, 12], ['slime_verde', 192, 22], ['caracol', 208, 28], ['slime_verde', 216, 28],
                   ['caracol', 221, 28], ['murcielago', 233, 17], ['murcielago', 239, 14], ['slime_verde', 246, 28], ['caracol', 254, 28],
                   ['slime_verde', 260, 28], ['murcielago', 266, 13], ['caracol', 276, 26], ['slime_verde', 284, 26]],
        colmenas: [],
        objetos: [['pluma', 160, 26], ['pocion', 194, 20]],
        controles: [[100, 28], [196, 22]],
        pistas: [[3, 'mover'], [10, 'saltar'], [14, 'atacar'], [23, 'bajar'], [33, 'pisar'], [47, 'caparazon'], [62, 'sprint'], [116, 'seta']],
        fin: { tipo: 'cofre', x: 292, fila: 26 },
    },
    {
        clave: 'otono', musica: 'otono', ancho: 330, suelo: 'h',
        cielo: { tinte: 0xffc58a, lejos: 0xffc89a, cerca: 0xf0b088, pinosLejos: 0x825a4c, pinosCerca: 0xc28a5a, fondo: '#f2b07a' },
        arboles: ['amarillo', 'rojo', 'dorado'], ambiente: 'otono', tinteSuelo: 0xfff0d0,
        inicio: [4, 28],
        tramos: [[0, 30, 28], [42, 62, 28], [62, 76, 24], [76, 96, 28], [112, 136, 28], [136, 150, 22], [150, 168, 28],
                 [168, 190, 16], [190, 200, 20], [200, 230, 28], [252, 280, 28], [280, 296, 25], [296, 330, 28]],
        bloques: [],
        plataformas: [[20, 24, 'rama'], [55, 23, 'tronco'], [88, 23, 'rama'], [120, 23, 'tronco'], [128, 20, 'rama'], [143, 17, 'tronco'],
                      [176, 11, 'tronco'], [205, 23, 'rama'], [214, 21, 'tronco'], [246, 24, 'rama'], [266, 22, 'rama'],
                      [272, 19, 'tronco'], [300, 23, 'rama'], [308, 20, 'tronco']],
        moviles: [[31, 25, 'tronco', 7, 0, 3.4], [163, 26, 'losa', 0, -10, 4.4], [232, 25, 'tronco', 6, 0, 3], [242, 23, 'tronco', 0, -3, 2.4]],
        caen: [[98, 25], [102, 23], [106, 25]],
        agua: [[30, 42], [96, 112], [230, 252]],
        pinchos: [[68, 24, 3], [84, 28, 2], [212, 28, 3], [286, 25, 2]],
        setas: [[93, 28], [258, 28]],
        monedas: [...fila(6, 26, 5), ...fila(20, 22, 5, 1), ...arco(31, 23, 7), ...fila(44, 26, 3), ...fila(55, 21, 3, 1),
                  ...fila(63, 22, 5), ...arco(67, 21, 3, 2), ...fila(78, 26, 4), ...arco(83, 25, 3, 2), ...fila(88, 21, 5, 1),
                  ...arco(97, 21, 9, 3), ...fila(114, 26, 4), ...fila(120, 21, 3, 1), ...fila(128, 18, 5, 1), ...fila(138, 20, 5),
                  ...fila(143, 15, 3, 1), ...fila(152, 26, 5), ...fila(163, 14, 3, 1), ...fila(170, 14, 5), ...fila(176, 9, 3, 1),
                  ...fila(192, 18, 4), ...fila(205, 21, 5, 1), ...fila(214, 19, 3, 1), ...arco(231, 22, 9, 3), ...fila(246, 22, 5, 1),
                  ...fila(254, 26, 4), ...fila(266, 20, 5, 1), ...fila(272, 17, 3, 1), ...fila(282, 23, 3), ...fila(300, 21, 5, 1),
                  ...fila(308, 18, 3, 1), ...fila(312, 26, 4)],
        enemigos: [['caracol', 12, 28], ['slime_morado', 24, 28], ['slime_morado', 73, 24], ['caracol', 80, 28], ['slime_morado', 90, 28],
                   ['caracol', 120, 28], ['slime_verde', 132, 28], ['caracol', 146, 22], ['slime_morado', 156, 28], ['murcielago', 178, 7],
                   ['caracol', 180, 16], ['slime_verde', 196, 20], ['caracol', 206, 28], ['slime_morado', 218, 28], ['slime_morado', 226, 28],
                   ['murcielago', 240, 17], ['caracol', 270, 28], ['slime_morado', 276, 28], ['slime_morado', 290, 25], ['caracol', 302, 28],
                   ['slime_verde', 312, 28], ['slime_morado', 318, 28]],
        colmenas: [[57, 19, 2], [126, 18, 2], [184, 9, 2], [262, 17, 3]],
        objetos: [['orbe', 47, 26], ['pocion', 186, 14]],
        controles: [[116, 28], [222, 28]],
        pistas: [[92, 'cae']],
        fin: { tipo: 'cofre', x: 322, fila: 28 },
    },
    {
        clave: 'sombrio', musica: 'sombrio', ancho: 360, suelo: 'p', noche: true,
        cielo: { tinte: 0x4a5a9a, lejos: 0x7a88b8, cerca: 0x6a78a8, pinosLejos: 0x1d2836, pinosCerca: 0x2c4050, fondo: '#1a2240' },
        arboles: ['oscuro', 'oscuro', 'dorado'], ambiente: 'luciernagas', tinteSuelo: 0xb8c0e0,
        inicio: [4, 28],
        tramos: [[0, 36, 28], [44, 70, 28], [70, 84, 23], [84, 110, 28], [126, 150, 28], [150, 168, 21], [168, 190, 25],
                 [204, 240, 28], [240, 256, 24], [266, 360, 28]],
        bloques: [[194, 22, 6, 3]],
        plataformas: [[20, 24, 'losa'], [26, 21, 'losa'], [56, 23, 'losa'], [62, 20, 'losa'], [96, 23, 'losa'], [102, 20, 'losa'],
                      [134, 23, 'losa'], [174, 20, 'losa'], [180, 17, 'losa'], [212, 23, 'losa'], [220, 20, 'losa'], [228, 23, 'losa'],
                      [244, 19, 'losa'], [272, 23, 'losa'], [278, 20, 'losa']],
        moviles: [],
        caen: [[38, 25], [112, 25], [116, 22], [120, 25], [259, 24]],
        agua: [], pinchos: [[88, 28, 2], [232, 28, 2]],
        setas: [],
        monedas: [...fila(6, 26, 4), ...fila(20, 22, 3, 1), ...fila(26, 19, 3, 1), ...arco(36, 24, 6), ...fila(48, 26, 5),
                  ...fila(56, 21, 3, 1), ...fila(62, 18, 3, 1), ...fila(72, 21, 6), ...fila(96, 21, 3, 1), ...fila(102, 18, 3, 1),
                  ...arco(111, 21, 10, 3), ...fila(128, 26, 4), ...fila(134, 21, 3, 1), ...fila(152, 19, 6), ...fila(174, 18, 3, 1),
                  ...fila(180, 15, 3, 1), ...arco(190, 21, 4, 2), ...fila(195, 20, 5, 1), ...arco(200, 20, 4, 2), ...fila(208, 26, 4),
                  ...fila(212, 21, 3, 1), ...fila(220, 18, 3, 1), ...fila(228, 21, 3, 1), ...fila(242, 22, 6), ...fila(244, 17, 3, 1),
                  ...arco(256, 22, 7, 2), ...fila(268, 26, 4), ...fila(272, 21, 3, 1), ...fila(278, 18, 3, 1)],
        enemigos: [['slime_azul', 14, 28], ['fantasma', 30, 22], ['murcielago', 48, 18], ['slime_azul', 58, 28], ['fantasma', 76, 18],
                   ['caracol', 92, 28], ['slime_azul', 100, 28], ['murcielago', 114, 16], ['murcielago', 122, 18], ['fantasma', 136, 20],
                   ['slime_azul', 144, 28], ['caracol', 156, 21], ['fantasma', 172, 16], ['slime_azul', 184, 25], ['murcielago', 196, 14],
                   ['fantasma', 210, 20], ['slime_azul', 218, 28], ['caracol', 226, 28], ['fantasma', 246, 16], ['slime_azul', 250, 24],
                   ['murcielago', 262, 16], ['fantasma', 274, 20], ['slime_azul', 282, 28]],
        colmenas: [],
        objetos: [['escudo', 140, 25], ['escudo', 236, 25], ['pocion', 292, 25]],
        controles: [[130, 28], [286, 28]],
        pistas: [[4, 'noche'], [296, 'jefe']],
        fin: { tipo: 'jefe', x0: 300, x1: 360, x: 340 },
    },
];
