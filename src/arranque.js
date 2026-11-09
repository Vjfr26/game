/* Escena de arranque: carga los gráficos, genera los sprites por código y crea las
   animaciones. Con ?nivel=N en la URL se entra directo a ese nivel (útil para probar). */
class Arranque extends Phaser.Scene {
    constructor() { super('Arranque'); }

    preload() {
        const barra = this.add.rectangle(ANCHO / 2 - 150, ALTO / 2, 0, 10, 0xffd23f).setOrigin(0, 0.5);
        this.add.rectangle(ANCHO / 2, ALTO / 2, 304, 16).setStrokeStyle(2, 0xffffff);
        this.add.text(ANCHO / 2, ALTO / 2 - 32, TXT.cargando, estiloTexto(20)).setOrigin(0.5);
        this.load.on('progress', (p) => barra.setSize(300 * p, 10));

        this.load.atlas('atlas', 'arte/atlas.png', 'arte/atlas.json');
        this.load.image('cielo', 'arte/cielo.png');
        this.load.image('bosque_lejos', 'arte/bosque-lejos.png');
        this.load.image('bosque_cerca', 'arte/bosque-cerca.png');
        const hoja = (clave, ruta, w, h) => this.load.spritesheet(clave, ruta, { frameWidth: w, frameHeight: h });
        hoja('heroe_quieto', 'Character/Idle/Idle-Sheet.png', 64, 80);
        hoja('heroe_corre', 'Character/Run/Run-Sheet.png', 80, 80);
        hoja('heroe_ataque', 'Character/Attack/Attack.png', 96, 80);
        hoja('heroe_salto', 'Character/Jump-All/Jump-All-Sheet.png', 64, 64);
        hoja('heroe_muere', 'Character/Dead/Dead-Sheet.png', 64, 64);
        hoja('caracol', 'Mob/Snail/walk-Sheet.png', 48, 32);
        hoja('caracol_esconde', 'Mob/Snail/Hide-Sheet.png', 48, 32);
        hoja('caracol_muere', 'Mob/Snail/Dead-Sheet.png', 48, 32);
    }

    create() {
        Arte.generar(this);
        const a = this.anims;
        const crear = (key, tex, frames, frameRate, repeat = -1) => {
            const lista = Array.isArray(frames) ? frames.map((f) => ({ key: tex, frame: f })) : a.generateFrameNumbers(tex, frames);
            a.create({ key, frames: lista, frameRate, repeat });
        };
        crear('h_quieto', 'heroe_quieto', { start: 0, end: 3 }, 7);
        crear('h_corre', 'heroe_corre', { start: 0, end: 7 }, 13);
        // La hoja de ataque es un combo: tajo (0-2) y giro con estocada (3-7)
        crear('h_ataque1', 'heroe_ataque', { start: 0, end: 2 }, 15, 0);
        crear('h_ataque2', 'heroe_ataque', { start: 3, end: 7 }, 16, 0);
        crear('h_sube', 'heroe_salto', { start: 2, end: 5 }, 12);
        crear('h_cima', 'heroe_salto', { start: 6, end: 8 }, 10);
        crear('h_cae', 'heroe_salto', { start: 9, end: 11 }, 10);
        crear('h_aterriza', 'heroe_salto', { start: 12, end: 14 }, 20, 0);
        crear('h_muere', 'heroe_muere', { start: 0, end: 9 }, 10, 0);
        crear('c_anda', 'caracol', { start: 0, end: 7 }, 8);
        crear('c_esconde', 'caracol_esconde', { start: 0, end: 7 }, 16, 0);
        crear('c_muere', 'caracol_muere', { start: 0, end: 7 }, 12, 0);
        for (const c of ['verde', 'morado', 'azul']) crear('s_' + c, 'slime_' + c, [0, 3], 4);
        crear('m_vuela', 'murcielago', { start: 0, end: 3 }, 12);
        crear('a_vuela', 'abeja', { start: 0, end: 1 }, 18);
        crear('f_flota', 'fantasma', { start: 0, end: 3 }, 6);
        crear('moneda_gira', 'moneda', { start: 0, end: 5 }, 10);
        crear('bandera_ondea', 'bandera', { start: 1, end: 3 }, 8);
        crear('magia_brilla', 'magia', { start: 0, end: 1 }, 14);

        const nivel = parseInt(new URLSearchParams(location.search).get('nivel'), 10);
        if (nivel >= 1 && nivel <= NIVELES.length) this.scene.start('Juego', { nivel: nivel - 1 });
        else this.scene.start('Menu');
    }
}
