/* Héroe, enemigos y jefe. Cada entidad decide su movimiento en actualizar(); la escena de
   juego (juego.js) se encarga de colisiones, efectos y marcador. */

const FISICA = {
    gravedad: 1400, salto: 560, dobleSalto: 500, corte: 210,
    camina: 130, sprint: 230,
    aceleracion: 1100, aceleracionSprint: 1500, aceleracionAire: 950, frenado: 1700, frenadoAire: 700,
    caidaMax: 760, coyote: 0.1, bufferSalto: 0.13,
    // Doble pulsación de la misma dirección para el sprint
    dobleToque: 0.28,
};

// Punto de apoyo de cada hoja del héroe (centro del torso y pies), medido sobre los dibujos:
// [x, y, ancho del fotograma, alto del fotograma]
const PIVOTE_HEROE = {
    heroe_quieto: [31, 64, 64, 80],
    heroe_corre: [46, 67, 80, 80],
    heroe_ataque: [50, 64, 96, 80],
    heroe_salto: [24, 63, 64, 64],
    heroe_muere: [32, 48, 64, 64],
};

const azar = Phaser.Math.FloatBetween;

/* ===================================================================== */
/* El héroe es una caja física fija (14 × 42, con el origen en los pies) y un sprite aparte que
   la sigue. Así, cambiar de animación (cada hoja tiene un tamaño distinto) nunca mueve la
   colisión: el dibujo se ancla a la caja en cada fotograma con el pivote medido de su hoja. */
class Jugador extends Phaser.GameObjects.Zone {
    constructor(escena, x, y) {
        super(escena, x, y, 14, 42);
        this.setOrigin(0.5, 1);
        escena.add.existing(this);
        escena.physics.add.existing(this);
        this.escena = escena;
        this.body.setMaxVelocity(420, FISICA.caidaMax);
        this.body.setCollideWorldBounds(true);
        this.vis = escena.add.sprite(x, y, 'heroe_quieto', 0).setDepth(10);
        this.vis.play('h_quieto');
        this.vidaMax = 3; this.vida = 3;
        this.manaMax = 3; this.mana = 3; this.recarga = 0;
        this.dir = 1;
        this.tCoyote = 0; this.tBuffer = 0; this.saltosAereos = 0; this.cortable = false;
        this.atacando = 0; this.enfriarAtaque = 0; this.enfriarMagia = 0; this.golpeados = new Set();
        this.invuln = 0; this.escudo = 0; this.bajando = 0; this.bloqueo = 0;
        this.muerto = false; this.celebrando = false; this.enSuelo = false; this.estabaEnSuelo = false;
        this.montura = null; this.tieneDoble = false; this.tieneMagia = false;
        this.faseAtaque = 0; this.inicioAtaque = -9; this.finAtaque = -9; this.encadenar = false; this.estocada = false;
        this.reloj = 0; this.ultimoPulso = { dir: 0, t: -9 }; this.sprint = false; this.sinMover = 0;
        this.tEstela = 0; this.tPolvo = 0;
        // El sprite se coloca después de la física, para no ir un paso por detrás
        escena.events.on('postupdate', this.sincronizar, this);
        escena.events.once('shutdown', () => escena.events.off('postupdate', this.sincronizar, this));
        this.sincronizar();
    }

    sincronizar() {
        const v = this.vis;
        if (!v.active) return;
        const [px, py, w, h] = PIVOTE_HEROE[v.texture.key] || [32, 64, 64, 80];
        v.setOrigin((v.flipX ? w - px : px) / w, py / h);
        v.setPosition(this.x, this.y);
    }

    anim(clave) {
        if (this.vis.anims.currentAnim?.key !== clave) this.vis.play(clave, true);
    }

    actualizar(dt, c) {
        const seg = dt / 1000;
        const b = this.body;
        this.reloj += seg;
        this.estabaEnSuelo = this.enSuelo;
        // touching.down también se activa al solaparse con un enemigo: no cuenta. Sobre una
        // plataforma móvil, la montura dice si se está encima
        this.enSuelo = b.blocked.down || !!this.montura;
        const atacaba = this.atacando > 0;
        for (const k of ['invuln', 'atacando', 'enfriarAtaque', 'enfriarMagia', 'bajando', 'bloqueo']) this[k] = Math.max(0, this[k] - seg);
        if (this.escudo > 0) {
            this.escudo -= seg;
            if (this.escudo <= 0) this.escena.romperEscudo(false);
        }

        // Fin de un golpe: encadena el giro si se pulsó durante el tajo
        if (atacaba && this.atacando <= 0) {
            this.finAtaque = this.reloj;
            // El giro remata hacia atrás: el héroe termina mirando hacia ese lado
            if (this.faseAtaque === 2) { this.enfriarAtaque = 0.22; this.dir = -this.dir; }
            if (this.encadenar && !this.muerto && this.faseAtaque === 1) this.empezarAtaque(2);
        }
        if (this.faseAtaque === 2 && this.atacando > 0 && !this.estocada && this.reloj - this.inicioAtaque >= 0.25) {
            this.estocada = true;
            this.golpeados.clear();
            Sonido.sfx('espada');
        }

        // Parpadeo mientras es invulnerable
        this.vis.setAlpha(this.invuln > 0 && !this.muerto ? (Math.floor(this.invuln * 14) % 2 ? 0.35 : 1) : 1);

        if (this.muerto) return;
        if (this.celebrando) {
            b.setVelocityX(b.velocity.x * 0.85);
            this.vis.anims.timeScale = 1;
            this.anim(this.enSuelo ? 'h_quieto' : 'h_cae');
            return;
        }

        if (this.enSuelo) {
            this.tCoyote = FISICA.coyote;
            this.saltosAereos = 0;
            if (!this.estabaEnSuelo && b.velocity.y >= 0) this.aterrizar();
        } else {
            this.tCoyote -= seg;
        }

        const libre = this.bloqueo <= 0;
        if (libre && c.saltar) this.tBuffer = FISICA.bufferSalto; else this.tBuffer -= seg;

        // Caminar por defecto; sprint al pulsar dos veces seguidas la misma dirección
        let eje = libre ? (c.der ? 1 : 0) - (c.izq ? 1 : 0) : 0;
        const pulso = c.pulsoDer ? 1 : c.pulsoIzq ? -1 : 0;
        if (pulso && libre) {
            if (pulso === this.ultimoPulso.dir && this.reloj - this.ultimoPulso.t < FISICA.dobleToque) this.empezarSprint(pulso);
            this.ultimoPulso = { dir: pulso, t: this.reloj };
        }
        if (this.sprint) {
            if (eje === -this.dirSprint) this.sprint = false;
            this.sinMover = eje === 0 ? this.sinMover + seg : 0;
            if (this.sinMover > 0.12 && this.enSuelo) this.sprint = false;
        }
        if (this.atacando > 0 && this.enSuelo) eje *= 0.3;
        const maxima = this.sprint ? FISICA.sprint : FISICA.camina;
        const objetivo = eje * maxima;
        let acel;
        if (eje !== 0) acel = !this.enSuelo ? FISICA.aceleracionAire : this.sprint ? FISICA.aceleracionSprint : FISICA.aceleracion;
        else acel = this.enSuelo ? FISICA.frenado : FISICA.frenadoAire;
        const vx = b.velocity.x;
        // Por encima de la velocidad máxima (empujón, fin del sprint) se frena poco a poco
        const paso = Math.abs(vx) > maxima + 5 && Math.sign(vx) === Math.sign(objetivo || vx) ? FISICA.frenadoAire * seg : acel * seg;
        b.setVelocityX(vx < objetivo ? Math.min(objetivo, vx + paso) : Math.max(objetivo, vx - paso));
        if (eje !== 0 && this.atacando <= 0) this.dir = eje;

        // Saltos: con margen tras dejar el borde (coyote) y pulsando un poco antes de tocar suelo (buffer)
        if (this.tBuffer > 0) {
            if (c.abajo && this.enSuelo && this.escena.sobreUnidireccional(this)) {
                this.bajando = 0.28; this.tBuffer = 0; this.montura = null;
                b.setVelocityY(40);
            } else if (this.tCoyote > 0) {
                this.saltar(FISICA.salto);
                this.escena.polvo(this.x, this.y, 6);
                Sonido.sfx('salto');
            } else if (this.tieneDoble && this.saltosAereos < 1) {
                this.saltosAereos++;
                this.saltar(FISICA.dobleSalto);
                this.escena.efectoDobleSalto(this.x, this.y);
                Sonido.sfx('doble');
            }
        }
        // Salto variable: soltar el botón corta la subida
        if (this.cortable && !c.saltarMantenido && b.velocity.y < -FISICA.corte) {
            b.setVelocityY(-FISICA.corte);
            this.cortable = false;
        }
        if (b.velocity.y >= 0) this.cortable = false;

        if (libre && c.atacar) this.atacar();
        if (libre && c.magia && this.tieneMagia && this.enfriarMagia <= 0) {
            if (this.mana >= 1) {
                this.mana--;
                this.enfriarMagia = 0.28;
                this.escena.lanzarMagia(this);
                Bus.emit('hud:mana', this.mana, this.manaMax);
            } else {
                this.enfriarMagia = 0.3;
                this.escena.textoFlotante(this.x, this.y - 54, '✦ 0', '#7fd6ff');
            }
        }
        if (this.tieneMagia && this.mana < this.manaMax) {
            this.recarga += seg;
            if (this.recarga >= 1.8) {
                this.recarga = 0; this.mana++;
                Bus.emit('hud:mana', this.mana, this.manaMax);
            }
        }

        this.efectosSprint(seg);
        this.elegirAnimacion();
        this.vis.setFlipX(this.dir < 0);
    }

    empezarSprint(dir) {
        if (this.sprint && this.dirSprint === dir) return;
        this.sprint = true;
        this.dirSprint = dir;
        this.sinMover = 0;
        if (this.enSuelo) {
            this.escena.polvo(this.x - dir * 10, this.y, 7);
            this.body.setVelocityX(dir * Math.max(Math.abs(this.body.velocity.x), FISICA.camina + 30));
        }
        Sonido.sfx('sprint');
    }

    /** Estela de imágenes y polvo mientras se corre a toda velocidad. */
    efectosSprint(seg) {
        if (!this.sprint || Math.abs(this.body.velocity.x) < FISICA.camina + 20) return;
        this.tEstela -= seg;
        this.tPolvo -= seg;
        if (this.tEstela <= 0) {
            this.tEstela = 0.06;
            const v = this.vis;
            const eco = this.escena.add.image(v.x, v.y, v.texture.key, v.frame.name)
                .setOrigin(v.originX, v.originY).setFlipX(v.flipX).setTintFill(0x8fe3ff).setAlpha(0.32).setDepth(9);
            this.escena.tweens.add({ targets: eco, alpha: 0, duration: 220, onComplete: () => eco.destroy() });
        }
        if (this.tPolvo <= 0 && this.enSuelo) {
            this.tPolvo = 0.11;
            this.escena.polvo(this.x - this.dir * 8, this.y, 1);
        }
    }

    saltar(v) {
        this.body.setVelocityY(-v);
        this.tCoyote = 0; this.tBuffer = 0;
        this.cortable = true;
        this.montura = null;
    }

    /** Rebote al pisar un enemigo o una seta: más alto si se mantiene el salto. */
    rebotar(v, mantener) {
        this.body.setVelocityY(-v);
        this.cortable = !!mantener;
        this.saltosAereos = 0;
        this.montura = null;
    }

    aterrizar() {
        // La animación de aterrizaje solo si llega casi parado: corriendo, frenaría el paso
        if (this.atacando <= 0 && Math.abs(this.body.velocity.x) < 40) this.vis.play('h_aterriza', true);
        this.escena.polvo(this.x, this.y, 4);
    }

    /** Primer toque: tajo hacia delante. Otro toque durante el tajo (o justo después): giro que
        golpea a ambos lados y remata con una estocada hacia atrás. La hoja de ataque es ese combo
        de dos golpes; usarla entera en cada toque dibujaba el corte detrás del héroe. */
    atacar() {
        if (this.atacando > 0) {
            if (this.faseAtaque === 1) this.encadenar = true;
            return;
        }
        if (this.enfriarAtaque > 0) return;
        const combo = this.faseAtaque === 1 && this.reloj - this.finAtaque < 0.3;
        this.empezarAtaque(combo ? 2 : 1);
    }

    empezarAtaque(fase) {
        this.faseAtaque = fase;
        this.encadenar = false;
        this.estocada = false;
        this.atacando = fase === 1 ? 0.2 : 0.34;
        this.inicioAtaque = this.reloj;
        this.golpeados.clear();
        this.vis.anims.timeScale = 1;
        this.vis.play(fase === 1 ? 'h_ataque1' : 'h_ataque2', true);
        Sonido.sfx('espada');
        if (this.enSuelo) this.body.setVelocityX(this.dir * (fase === 1 ? 50 : 90));
    }

    /** Zonas que corta la espada en este momento, según el fotograma del golpe. */
    zonasEspada() {
        if (this.atacando <= 0) return [];
        const t = this.reloj - this.inicioAtaque;
        const zona = (dx, w, h, dy = -24) => ({ x: this.x + dx, y: this.y + dy, w, h });
        if (this.faseAtaque === 1) return t >= 0.03 && t <= 0.16 ? [zona(this.dir * 26, 50, 46)] : [];
        if (t >= 0.11 && t < 0.25) return [zona(26, 48, 48), zona(-26, 48, 48)];
        // Estocada final: en el dibujo va hacia atrás (el héroe se ha dado la vuelta)
        if (t >= 0.25 && t <= 0.34) return [zona(-this.dir * 38, 62, 22, -26)];
        return [];
    }

    elegirAnimacion() {
        if (this.atacando > 0) return;
        const vy = this.body.velocity.y;
        const v = this.vis;
        if (!this.enSuelo) {
            v.anims.timeScale = 1;
            if (vy < -140) this.anim('h_sube');
            else if (vy < 140) this.anim('h_cima');
            else this.anim('h_cae');
            return;
        }
        const actual = v.anims.currentAnim?.key;
        if (actual === 'h_aterriza' && v.anims.isPlaying) return;
        const rapidez = Math.abs(this.body.velocity.x);
        if (rapidez > 20) {
            this.anim('h_corre');
            // El paso se ajusta a la velocidad: andar tranquilo o correr
            v.anims.timeScale = Phaser.Math.Clamp(rapidez / 175, 0.55, 1.35);
        } else {
            v.anims.timeScale = 1;
            this.anim('h_quieto');
        }
    }

    /** Devuelve true si el golpe le quitó vida. */
    herir(desdeX) {
        if (this.invuln > 0 || this.muerto || this.celebrando) return false;
        const dir = this.x < desdeX ? -1 : 1;
        this.body.setVelocity(dir * 260, -330);
        this.cortable = false;
        this.sprint = false;
        if (this.escudo > 0) {
            this.escena.romperEscudo(true);
            this.invuln = 0.9;
            return false;
        }
        this.vida--;
        this.invuln = 1.4;
        this.bloqueo = 0.18;
        Bus.emit('hud:vida', this.vida, this.vidaMax);
        this.escena.efectoDanio(this);
        if (this.vida <= 0) this.morir();
        return true;
    }

    morir() {
        this.muerto = true;
        this.atacando = 0;
        this.sprint = false;
        this.body.setVelocityX(0);
        this.vis.anims.timeScale = 1;
        this.vis.play('h_muere', true);
        this.escena.alSerDerrotado();
    }

    revivir(x, y) {
        this.muerto = false; this.celebrando = false; this.sprint = false;
        this.vida = this.vidaMax; this.mana = this.manaMax;
        this.invuln = 1.6; this.escudo = 0; this.bloqueo = 0.3;
        this.body.reset(x, y);
        this.vis.play('h_quieto');
        this.sincronizar();
        Bus.emit('hud:vida', this.vida, this.vidaMax);
        Bus.emit('hud:mana', this.mana, this.manaMax);
    }
}

/* ===================================================================== */
class Enemigo extends Phaser.Physics.Arcade.Sprite {
    constructor(escena, x, y, textura, opciones) {
        super(escena, x, y, textura, 0);
        escena.add.existing(this);
        escena.physics.add.existing(this);
        this.escena = escena;
        this.tipo = opciones.tipo;
        this.vida = opciones.vida || 1;
        this.puntos = opciones.puntos || 50;
        this.color = opciones.color || 0xffffff;
        this.pisable = opciones.pisable !== false;
        this.peligroso = true;
        this.vivo = true;
        this.invulnT = 0;
        this.setDepth(8);
        this.setOrigin(0.5, 1);
    }

    /** Devuelve true si el golpe hizo efecto. */
    herir(cant, dirX) {
        if (!this.vivo || this.invulnT > 0) return false;
        this.vida -= cant;
        this.invulnT = 0.22;
        this.setTintFill(0xffffff);
        this.escena.time.delayedCall(70, () => this.vivo && this.clearTint());
        if (this.vida <= 0) { this.morir(dirX); return true; }
        this.empujar(dirX);
        return true;
    }

    empujar(dirX) {
        if (this.body.allowGravity) this.body.setVelocity(dirX * 160, -160);
        else this.body.setVelocity(dirX * 200, -40);
    }

    /** Pisotón desde arriba: por defecto, como un golpe. */
    pisado(jugador) {
        this.herir(this.vida, jugador.x < this.x ? 1 : -1);
    }

    morir(dirX) {
        if (!this.vivo) return;
        this.vivo = false;
        this.escena.alMorirEnemigo(this, dirX || 0);
        this.body.enable = false;
        this.escena.tweens.add({
            targets: this, alpha: 0, scaleY: this.scaleY * 0.3, scaleX: this.scaleX * 1.4, duration: 180,
            onComplete: () => this.destroy(),
        });
    }

    actualizar(seg, jugador) {
        this.invulnT = Math.max(0, this.invulnT - seg);
        if (this.y > this.escena.altoMundo + 80) this.destroy();
    }
}

/* ---------- Caracol: patrulla, se esconde al pisarlo y su concha se puede patear ---------- */
class Caracol extends Enemigo {
    constructor(escena, x, y) {
        super(escena, x, y, 'caracol', { tipo: 'caracol', vida: 1, puntos: 50, color: 0xff6a4d });
        this.body.setSize(28, 18).setOffset(10, 14);
        this.estado = 'anda';
        this.dir = -1;
        this.limites = escena.limitesSuelo(x, y);
        this.play('c_anda');
        this.tConcha = 0; this.tPatina = 0; this.rebotes = 0;
    }

    actualizar(seg, jugador) {
        super.actualizar(seg, jugador);
        if (!this.vivo || !this.active) return;
        const b = this.body;
        if (this.estado === 'anda') {
            if ((this.limites && (this.x < this.limites[0] && this.dir < 0)) || b.blocked.left) this.dir = 1;
            if ((this.limites && (this.x > this.limites[1] && this.dir > 0)) || b.blocked.right) this.dir = -1;
            b.setVelocityX(this.dir * 32);
            this.setFlipX(this.dir > 0);
        } else if (this.estado === 'concha') {
            b.setVelocityX(b.velocity.x * 0.85);
            this.tConcha -= seg;
            if (this.tConcha <= 0) {
                this.estado = 'anda';
                this.peligroso = true;
                this.playReverse('c_esconde');
                this.once('animationcomplete', () => this.vivo && this.estado === 'anda' && this.play('c_anda'));
            }
        } else if (this.estado === 'patina') {
            if (b.blocked.left || b.blocked.right) {
                this.dirPatina *= -1;
                this.rebotes++;
                this.escena.temblor(60, 0.003);
                Sonido.sfx('golpe');
            }
            b.setVelocityX(this.dirPatina * 330);
            this.tPatina -= seg;
            if (this.tPatina <= 0 || this.rebotes > 3) this.morir(0);
        }
    }

    pisado(jugador) {
        if (this.estado === 'anda') {
            this.estado = 'concha';
            this.peligroso = false;
            this.tConcha = 4;
            this.body.setVelocityX(0);
            this.play('c_esconde');
            Sonido.sfx('pisar');
            this.escena.sumarPuntos(20, this.x, this.y - 30);
        } else {
            this.patear(jugador.x < this.x ? 1 : -1);
        }
    }

    patear(dir) {
        if (this.estado === 'patina') return;
        this.estado = 'patina';
        this.peligroso = false;
        this.dirPatina = dir;
        this.tPatina = 6;
        this.rebotes = 0;
        this.anims.stop();
        this.setFrame(7);
        Sonido.sfx('golpe');
        this.escena.chispas(this.x, this.y - 10, 0xffffff, 6);
    }

    herir(cant, dirX) {
        if (this.estado === 'concha') { this.patear(dirX || 1); return true; }
        if (this.estado === 'patina') return false;
        return super.herir(cant, dirX);
    }

    morir(dirX) {
        if (!this.vivo) return;
        this.vivo = false;
        this.escena.alMorirEnemigo(this, dirX);
        this.body.enable = false;
        this.play('c_muere');
        this.once('animationcomplete', () => this.escena.tweens.add({ targets: this, alpha: 0, duration: 200, onComplete: () => this.destroy() }));
    }
}

/* ---------- Slime: salta hacia el jugador; el azul se divide al morir ---------- */
class Slime extends Enemigo {
    constructor(escena, x, y, color, mini) {
        const vidas = { verde: 1, morado: 2, azul: 2 };
        super(escena, x, y, 'slime_' + color, {
            tipo: 'slime', vida: mini ? 1 : vidas[color], puntos: color === 'verde' || mini ? 60 : 90,
            color: { verde: 0x5ccf4a, morado: 0xa15ce0, azul: 0x3fb6ec }[color],
        });
        this.colorSlime = color;
        this.mini = !!mini;
        const escala = mini ? 0.7 : color === 'morado' ? 1.35 : 1;
        this.setScale(escala);
        this.body.setSize(16, 12).setOffset(3, 6);
        this.espera = azar(0.3, 1.2);
        this.tAplasta = 0;
        this.enSuelo = false;
        this.play('s_' + color);
    }

    actualizar(seg, jugador) {
        super.actualizar(seg, jugador);
        if (!this.vivo || !this.active) return;
        const b = this.body;
        const antes = this.enSuelo;
        this.enSuelo = b.blocked.down;
        if (this.enSuelo && !antes) {
            this.tAplasta = 0.14;
            this.anims.stop(); this.setFrame(1);
            b.setVelocityX(0);
            this.escena.polvo(this.x, this.y, 3);
        }
        if (this.tAplasta > 0) {
            this.tAplasta -= seg;
            if (this.tAplasta <= 0) this.play('s_' + this.colorSlime);
            return;
        }
        if (!this.enSuelo) { this.anims.stop(); this.setFrame(2); return; }
        this.espera -= seg;
        if (this.espera > 0) return;
        const dx = jugador.x - this.x;
        const cerca = Math.abs(dx) < 320 && Math.abs(jugador.y - this.y) < 180 && !jugador.muerto;
        let dir = cerca ? Math.sign(dx) : (Math.random() < 0.5 ? -1 : 1);
        const vel = { verde: 115, morado: 95, azul: 150 }[this.colorSlime];
        const vy = cerca ? azar(380, 440) : azar(260, 320);
        // No saltar al vacío: mira dónde caería de verdad (y a mitad de camino); si no hay
        // suelo, salta en el sitio
        const alcance = vel * (2 * vy / FISICA.gravedad);
        if (dir && !(this.escena.haySuelo(this.x + dir * alcance, this.y) && this.escena.haySuelo(this.x + dir * alcance * 0.5, this.y))) dir = 0;
        b.setVelocity(dir * vel, -vy);
        this.setFlipX(dir > 0);
        this.espera = this.colorSlime === 'morado' ? azar(1.0, 1.8) : this.colorSlime === 'azul' ? azar(0.5, 1.0) : azar(0.7, 1.4);
    }

    morir(dirX) {
        if (!this.vivo) return;
        if (this.colorSlime === 'azul' && !this.mini) {
            // Se parte en dos slimes pequeños
            [-1, 1].forEach((lado) => {
                const hijo = this.escena.crearEnemigo('slime_azul_mini', this.x + lado * 8, this.y - 4);
                hijo.body.setVelocity(lado * 150, -320);
                hijo.espera = 0.6;
            });
        }
        super.morir(dirX);
    }
}

/* ---------- Murciélago: duerme hasta verte, te persigue y se lanza en picado ---------- */
class Murcielago extends Enemigo {
    constructor(escena, x, y) {
        super(escena, x, y, 'murcielago', { tipo: 'murcielago', vida: 1, puntos: 80, color: 0x7a55aa });
        this.setOrigin(0.5);
        this.body.allowGravity = false;
        this.body.setSize(14, 10).setOffset(5, 4);
        this.base = new Phaser.Math.Vector2(x, y);
        this.estado = 'duerme';
        this.t = azar(0, 6);
        this.tEstado = 0;
        this.play('m_vuela');
        this.anims.timeScale = 0.5;
    }

    actualizar(seg, jugador) {
        super.actualizar(seg, jugador);
        if (!this.vivo || !this.active) return;
        this.t += seg;
        this.tEstado -= seg;
        const b = this.body;
        const dx = jugador.x - this.x, dy = (jugador.y - 30) - this.y;
        const dist = Math.hypot(dx, dy);
        if (this.estado === 'duerme') {
            b.setVelocity((this.base.x - this.x) * 2, (this.base.y + Math.sin(this.t * 2) * 6 - this.y) * 2);
            if (dist < 250 && !jugador.muerto) { this.estado = 'caza'; this.tEstado = azar(1.6, 2.6); this.anims.timeScale = 1; }
        } else if (this.estado === 'caza') {
            const v = 90;
            b.setVelocity((dx / (dist || 1)) * v, (dy / (dist || 1)) * v + Math.sin(this.t * 6) * 70);
            if (this.tEstado <= 0) {
                this.estado = 'picada'; this.tEstado = 0.6;
                const n = Math.hypot(dx, dy + 30) || 1;
                b.setVelocity((dx / n) * 250, ((dy + 30) / n) * 250);
            }
            if (dist > 520) { this.estado = 'duerme'; this.anims.timeScale = 0.5; }
        } else if (this.estado === 'picada') {
            if (this.tEstado <= 0) { this.estado = 'sube'; this.tEstado = 0.7; b.setVelocity(b.velocity.x * 0.3, -130); }
        } else if (this.estado === 'sube') {
            if (this.tEstado <= 0) { this.estado = 'caza'; this.tEstado = azar(1.8, 2.8); }
        }
        this.setFlipX(b.velocity.x > 0);
    }
}

/* ---------- Abeja: vuela alrededor de su colmena y embiste si te acercas ---------- */
class Abeja extends Enemigo {
    constructor(escena, x, y, colmena) {
        super(escena, x, y, 'abeja', { tipo: 'abeja', vida: 1, puntos: 80, color: 0xffcf33 });
        this.setOrigin(0.5);
        this.body.allowGravity = false;
        this.body.setSize(12, 10).setOffset(3, 4);
        this.casa = colmena;
        this.angulo = azar(0, Math.PI * 2);
        this.estado = 'ronda';
        this.tEstado = 0; this.enfriar = azar(0.5, 1.5);
        this.play('a_vuela');
    }

    actualizar(seg, jugador) {
        super.actualizar(seg, jugador);
        if (!this.vivo || !this.active) return;
        const b = this.body;
        this.tEstado -= seg;
        this.enfriar -= seg;
        const dx = jugador.x - this.x, dy = (jugador.y - 26) - this.y;
        const dist = Math.hypot(dx, dy);
        if (this.estado === 'ronda') {
            this.angulo += seg * 1.6;
            const tx = this.casa.x + Math.cos(this.angulo) * 56, ty = this.casa.y + Math.sin(this.angulo * 2) * 22;
            b.setVelocity((tx - this.x) * 3, (ty - this.y) * 3);
            if (dist < 200 && this.enfriar <= 0 && !jugador.muerto) { this.estado = 'apunta'; this.tEstado = 0.45; b.setVelocity(0, 0); }
        } else if (this.estado === 'apunta') {
            this.x += Math.sin(this.tEstado * 80) * 1.2;
            this.setTint(Math.floor(this.tEstado * 20) % 2 ? 0xff6060 : 0xffffff);
            if (this.tEstado <= 0) {
                this.clearTint();
                this.estado = 'carga'; this.tEstado = 0.55;
                b.setVelocity((dx / (dist || 1)) * 310, (dy / (dist || 1)) * 310);
                Sonido.sfx('cascabel');
            }
        } else if (this.estado === 'carga') {
            if (this.tEstado <= 0) this.estado = 'vuelve';
        } else if (this.estado === 'vuelve') {
            const hx = this.casa.x - this.x, hy = this.casa.y - this.y, hd = Math.hypot(hx, hy);
            b.setVelocity((hx / (hd || 1)) * 140, (hy / (hd || 1)) * 140);
            if (hd < 30) { this.estado = 'ronda'; this.enfriar = azar(1.0, 1.8); }
        }
        this.setFlipX(b.velocity.x > 0 ? false : b.velocity.x < 0);
    }
}

/* ---------- Fantasma: atraviesa paredes, te sigue y a ratos se vuelve intangible ---------- */
class Fantasma extends Enemigo {
    constructor(escena, x, y) {
        super(escena, x, y, 'fantasma', { tipo: 'fantasma', vida: 2, puntos: 100, color: 0xc4cff2, pisable: false });
        this.setOrigin(0.5);
        this.body.allowGravity = false;
        this.body.setSize(14, 16).setOffset(4, 4);
        this.t = azar(0, 5);
        this.tEtereo = azar(2.5, 4);
        this.etereo = 0;
        this.setAlpha(0.85);
        this.play('f_flota');
    }

    actualizar(seg, jugador) {
        super.actualizar(seg, jugador);
        if (!this.vivo || !this.active) return;
        this.t += seg;
        const b = this.body;
        const dx = jugador.x - this.x, dy = (jugador.y - 30) - this.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 380 && !jugador.muerto) {
            b.setVelocity((dx / (dist || 1)) * 46, (dy / (dist || 1)) * 46 + Math.sin(this.t * 3) * 20);
        } else {
            b.setVelocity(0, Math.sin(this.t * 2) * 16);
        }
        this.setFlipX(dx > 0);
        if (this.etereo > 0) {
            this.etereo -= seg;
            if (this.etereo <= 0) { this.peligroso = true; this.tEtereo = azar(2.8, 4.2); this.escena.tweens.add({ targets: this, alpha: 0.85, duration: 200 }); }
        } else {
            this.tEtereo -= seg;
            if (this.tEtereo <= 0) { this.etereo = 1.3; this.peligroso = false; this.escena.tweens.add({ targets: this, alpha: 0.22, duration: 200 }); }
        }
    }

    herir(cant, dirX) {
        if (this.etereo > 0) return false;
        return super.herir(cant, dirX);
    }
}

/* ===================================================================== */
/* El Rey Slime: saltitos, gran salto con ondas de choque, escupitajos y súbditos.
   Tres fases según la vida que le queda. */
class Jefe extends Enemigo {
    constructor(escena, x, y, arena) {
        super(escena, x, y, 'rey', { tipo: 'jefe', vida: 34, puntos: 2000, color: 0x4fc79a });
        this.vidaMax = this.vida;
        this.arena = arena;
        this.setScale(2);
        this.setDepth(9);
        this.body.setSize(50, 32).setOffset(7, 26);
        this.body.setMaxVelocity(600, 1200);
        this.estado = 'entrada';
        this.t = 0; this.espera = 1.2; this.saltosPendientes = 0;
        this.enSuelo = false; this.fase = 1;
        this.setFrame(2);
    }

    get faseActual() {
        const p = this.vida / this.vidaMax;
        return p > 0.6 ? 1 : p > 0.3 ? 2 : 3;
    }

    actualizar(seg, jugador) {
        this.invulnT = Math.max(0, this.invulnT - seg);
        if (!this.vivo || !this.active) return;
        const b = this.body;
        const antes = this.enSuelo;
        this.enSuelo = b.blocked.down;
        const aterriza = this.enSuelo && !antes;

        const fase = this.faseActual;
        if (fase !== this.fase) {
            this.fase = fase;
            if (fase === 3) { this.setTint(0xff9a9a); this.escena.textoFlotante(this.x, this.y - 140, '!!', '#ff5a5a', 32); }
            this.escena.temblor(250, 0.008);
            Sonido.sfx('temblor');
        }

        if (aterriza) {
            this.setFrame(1);
            this.escena.time.delayedCall(120, () => this.vivo && this.setFrame(0));
            if (this.estado === 'entrada' || this.estado === 'granSalto') {
                this.escena.golpeJefe(this, true);
                if (this.estado === 'entrada') this.escena.jefeListo(this);
                this.estado = 'espera';
                this.espera = this.pausa();
            } else if (this.estado === 'saltitos') {
                this.escena.golpeJefe(this, false);
                b.setVelocityX(0);
                if (this.saltosPendientes > 0) this.espera = 0.22;
                else { this.estado = 'espera'; this.espera = this.pausa(); }
            }
        }

        if (!this.enSuelo) { if (this.estado !== 'muere') this.setFrame(2); return; }
        b.setVelocityX(b.velocity.x * 0.8);
        this.setFlipX(jugador.x > this.x);
        this.espera -= seg;
        if (this.espera > 0) {
            if (this.estado === 'espera') this.setFrame(Math.floor(this.escena.time.now / 220) % 2 ? 3 : 0);
            return;
        }

        if (this.estado === 'saltitos' && this.saltosPendientes > 0) {
            this.saltosPendientes--;
            const dir = Math.sign(jugador.x - this.x) || 1;
            b.setVelocity(dir * (fase === 3 ? 230 : 180), -470);
            Sonido.sfx('salto');
            return;
        }

        // Elegir el siguiente ataque
        const opciones = ['saltitos', 'granSalto', 'escupir'];
        if (fase >= 2 && this.escena.contarSubditos() < 3) opciones.push('invocar');
        if (fase === 3) opciones.push('granSalto');
        const elegido = Phaser.Utils.Array.GetRandom(opciones);
        if (elegido === 'saltitos') {
            this.estado = 'saltitos';
            this.saltosPendientes = fase === 1 ? 3 : 4;
            this.espera = 0;
        } else if (elegido === 'granSalto') {
            this.estado = 'granSalto';
            this.setFrame(1);
            const dx = Phaser.Math.Clamp(jugador.x - this.x, -380, 380);
            this.escena.time.delayedCall(260, () => {
                if (!this.vivo) return;
                b.setVelocity(dx / 1.15, -820);
                Sonido.sfx('rebote');
            });
            this.espera = 10;
        } else if (elegido === 'escupir') {
            this.estado = 'espera';
            this.setFrame(1);
            const n = fase === 1 ? 3 : 5;
            for (let i = 0; i < n; i++) {
                this.escena.time.delayedCall(260 + i * 140, () => this.vivo && this.escena.escupirBaba(this, jugador, i - (n - 1) / 2));
            }
            this.espera = 0.26 + n * 0.14 + this.pausa();
        } else {
            this.estado = 'espera';
            this.escena.invocarSubditos(this);
            this.espera = this.pausa() + 0.4;
        }
    }

    pausa() {
        return this.fase === 1 ? azar(0.9, 1.3) : this.fase === 2 ? azar(0.6, 0.95) : azar(0.4, 0.7);
    }

    empujar() { /* demasiado grande para salir despedido */ }

    herir(cant, dirX) {
        if (!this.vivo || this.invulnT > 0 || this.estado === 'entrada') return false;
        this.vida -= cant;
        this.invulnT = 0.3;
        this.setTintFill(0xffffff);
        this.escena.time.delayedCall(80, () => { if (!this.vivo) return; this.clearTint(); if (this.fase === 3) this.setTint(0xff9a9a); });
        Sonido.sfx('jefeGolpe');
        Bus.emit('hud:jefe', Math.max(0, this.vida), this.vidaMax);
        if (this.vida <= 0) this.morir();
        return true;
    }

    pisado(jugador) {
        this.herir(2, 0);
    }

    morir() {
        if (!this.vivo) return;
        this.vivo = false;
        this.estado = 'muere';
        this.body.enable = false;
        this.escena.derrotarJefe(this);
    }
}
