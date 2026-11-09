/* Textos del juego en los tres idiomas del portafolio. El idioma sale del mismo
   localStorage que usa la web (misma origen), o del navegador. */
const IDIOMA = (() => {
    try {
        const guardado = localStorage.getItem('language');
        if (['es', 'en', 'pt'].includes(guardado)) return guardado;
    } catch (e) { /* sin almacenamiento */ }
    const nav = (navigator.language || 'en').slice(0, 2);
    return ['es', 'pt'].includes(nav) ? nav : 'en';
})();

const TEXTOS = {
    es: {
        titulo: 'FOREST QUEST',
        lema: 'El Rey Slime ha oscurecido el bosque. Recupéralo.',
        jugar: 'Jugar', continuar: 'Continuar', niveles: 'Niveles', controles: 'Controles',
        sonidoSi: 'Sonido: sí', sonidoNo: 'Sonido: no', volver: 'Volver', bloqueado: 'Bloqueado',
        pulsa: 'Pulsa ENTER o haz clic', toca: 'Toca para empezar', cargando: 'Cargando…',
        nivel: 'Nivel',
        nombres: ['Bosque Verde', 'Otoño Dorado', 'Bosque Sombrío'],
        listaControles: [
            ['← →  /  A D', 'Caminar'],
            ['→ →  /  ← ←', 'Sprint (pulsa dos veces)'],
            ['↑  /  W', 'Saltar (mantén para saltar más)'],
            ['↑ en el aire', 'Doble salto (con la pluma)'],
            ['ESPACIO  /  J', 'Espada (otra vez: giro)'],
            ['X  /  K', 'Lanzar magia (con el orbe)'],
            ['↓ + ↑', 'Bajar de una plataforma'],
            ['P  /  ESC', 'Pausa'],
            ['M', 'Sonido'],
        ],
        pistas: {
            mover: 'Camina con ← → o A D',
            sprint: 'Pulsa dos veces → para correr a toda velocidad y saltar más lejos',
            saltar: 'Salta con ↑ o W. Mantén pulsado para llegar más alto',
            atacar: 'ESPACIO para atacar con la espada',
            bajar: '↓ + ↑ para bajar de una plataforma',
            pisar: 'Salta encima de los slimes para aplastarlos',
            caparazon: 'Pisa un caracol y patea su caparazón',
            seta: 'Las setas grandes te lanzan por los aires',
            doble: 'Pulsa ↑ otra vez en el aire para el doble salto',
            cae: 'Las losas se hunden al pisarlas: ¡no te pares!',
            noche: 'Los fantasmas no se pueden pisar: usa la espada o la magia',
            jefe: 'Algo enorme se acerca…',
        },
        pistasTactil: {
            mover: 'Camina con ◀ ▶',
            sprint: 'Toca dos veces ▶ para correr a toda velocidad',
            saltar: 'Salta con ▲. Mantén pulsado para llegar más alto',
            atacar: 'Pulsa ⚔ para atacar con la espada',
            bajar: '▼ para bajar de una plataforma',
            doble: 'Pulsa ▲ otra vez en el aire para el doble salto',
        },
        poderes: {
            pluma: ['¡Doble salto!', 'Pulsa ↑ otra vez en el aire'],
            orbe: ['¡Orbe arcano!', 'Pulsa X para lanzar magia'],
            escudo: ['¡Escudo!', 'Te protege de un golpe'],
            pocion: ['+1 corazón', ''],
        },
        poderesTactil: { pluma: 'Pulsa ▲ otra vez en el aire', orbe: 'Pulsa ✦ para lanzar magia' },
        control: '¡Punto de control!',
        jefe: 'REY SLIME',
        completado: '¡Nivel completado!',
        monedas: 'Monedas', enemigos: 'Enemigos', tiempo: 'Tiempo', muertes: 'Derrotas', puntos: 'Puntos',
        estrellas: ['Completar el nivel', '80 % de las monedas', 'Sin ser derrotado'],
        siguiente: 'Siguiente nivel', menu: 'Menú', reintentar: 'Repetir nivel', verFinal: 'Continuar',
        pausa: 'Pausa', reanudar: 'Continuar', reiniciar: 'Reiniciar nivel', salir: 'Menú principal',
        derrota: '¡Derrotado!', vuelves: 'Vuelves al último punto de control',
        finTitulo: '¡Has salvado el bosque!',
        finTexto: 'El Rey Slime ha caído y la luz vuelve a cada rincón.',
        totalPuntos: 'Puntos totales', totalEstrellas: 'Estrellas', gracias: 'Gracias por jugar',
        creditos: 'Juego: Victor Fernandes · Gráficos: Legacy Fantasy (Anokolisa) · Fuente: Pixelify Sans',
    },
    en: {
        titulo: 'FOREST QUEST',
        lema: 'The Slime King has darkened the forest. Take it back.',
        jugar: 'Play', continuar: 'Continue', niveles: 'Levels', controles: 'Controls',
        sonidoSi: 'Sound: on', sonidoNo: 'Sound: off', volver: 'Back', bloqueado: 'Locked',
        pulsa: 'Press ENTER or click', toca: 'Tap to start', cargando: 'Loading…',
        nivel: 'Level',
        nombres: ['Green Forest', 'Golden Autumn', 'Shadow Forest'],
        listaControles: [
            ['← →  /  A D', 'Walk'],
            ['→ →  /  ← ←', 'Sprint (double tap)'],
            ['↑  /  W', 'Jump (hold to jump higher)'],
            ['↑ in the air', 'Double jump (with the feather)'],
            ['SPACE  /  J', 'Sword (again: spin)'],
            ['X  /  K', 'Cast magic (with the orb)'],
            ['↓ + ↑', 'Drop through a platform'],
            ['P  /  ESC', 'Pause'],
            ['M', 'Sound'],
        ],
        pistas: {
            mover: 'Walk with ← → or A D',
            sprint: 'Double-tap → to sprint and jump further',
            saltar: 'Jump with ↑ or W. Hold it to jump higher',
            atacar: 'SPACE to swing your sword',
            bajar: '↓ + ↑ to drop through a platform',
            pisar: 'Jump on slimes to squash them',
            caparazon: 'Stomp a snail and kick its shell',
            seta: 'Big mushrooms launch you into the air',
            doble: 'Press ↑ again in the air to double jump',
            cae: 'Stone slabs sink when you step on them: keep moving!',
            noche: 'Ghosts cannot be stomped: use your sword or magic',
            jefe: 'Something huge is coming…',
        },
        pistasTactil: {
            mover: 'Walk with ◀ ▶',
            sprint: 'Double-tap ▶ to sprint',
            saltar: 'Jump with ▲. Hold it to jump higher',
            atacar: 'Tap ⚔ to swing your sword',
            bajar: '▼ to drop through a platform',
            doble: 'Tap ▲ again in the air to double jump',
        },
        poderes: {
            pluma: ['Double jump!', 'Press ↑ again in the air'],
            orbe: ['Arcane orb!', 'Press X to cast magic'],
            escudo: ['Shield!', 'Blocks one hit'],
            pocion: ['+1 heart', ''],
        },
        poderesTactil: { pluma: 'Tap ▲ again in the air', orbe: 'Tap ✦ to cast magic' },
        control: 'Checkpoint!',
        jefe: 'SLIME KING',
        completado: 'Level complete!',
        monedas: 'Coins', enemigos: 'Enemies', tiempo: 'Time', muertes: 'Defeats', puntos: 'Score',
        estrellas: ['Finish the level', '80% of the coins', 'Never defeated'],
        siguiente: 'Next level', menu: 'Menu', reintentar: 'Replay level', verFinal: 'Continue',
        pausa: 'Paused', reanudar: 'Resume', reiniciar: 'Restart level', salir: 'Main menu',
        derrota: 'Defeated!', vuelves: 'Back to the last checkpoint',
        finTitulo: 'You saved the forest!',
        finTexto: 'The Slime King has fallen and light returns to every corner.',
        totalPuntos: 'Total score', totalEstrellas: 'Stars', gracias: 'Thanks for playing',
        creditos: 'Game: Victor Fernandes · Art: Legacy Fantasy (Anokolisa) · Font: Pixelify Sans',
    },
    pt: {
        titulo: 'FOREST QUEST',
        lema: 'O Rei Slime escureceu a floresta. Recupera-a.',
        jugar: 'Jogar', continuar: 'Continuar', niveles: 'Níveis', controles: 'Controlos',
        sonidoSi: 'Som: sim', sonidoNo: 'Som: não', volver: 'Voltar', bloqueado: 'Bloqueado',
        pulsa: 'Prime ENTER ou clica', toca: 'Toca para começar', cargando: 'A carregar…',
        nivel: 'Nível',
        nombres: ['Floresta Verde', 'Outono Dourado', 'Floresta Sombria'],
        listaControles: [
            ['← →  /  A D', 'Caminar'],
            ['→ →  /  ← ←', 'Sprint (prime duas vezes)'],
            ['↑  /  W', 'Saltar (mantém para saltar mais)'],
            ['↑ no ar', 'Salto duplo (com a pena)'],
            ['ESPAÇO  /  J', 'Espada (outra vez: giro)'],
            ['X  /  K', 'Lançar magia (com o orbe)'],
            ['↓ + ↑', 'Descer de uma plataforma'],
            ['P  /  ESC', 'Pausa'],
            ['M', 'Som'],
        ],
        pistas: {
            mover: 'Caminha com ← → ou A D',
            sprint: 'Prime duas vezes → para correr a toda a velocidade e saltar mais longe',
            saltar: 'Salta com ↑ ou W. Mantém premido para ir mais alto',
            atacar: 'ESPAÇO para atacar com a espada',
            bajar: '↓ + ↑ para descer de uma plataforma',
            pisar: 'Salta em cima dos slimes para os esmagar',
            caparazon: 'Pisa um caracol e chuta a carapaça',
            seta: 'Os cogumelos grandes atiram-te pelos ares',
            doble: 'Prime ↑ outra vez no ar para o salto duplo',
            cae: 'As lajes afundam quando as pisas: não pares!',
            noche: 'Os fantasmas não se podem pisar: usa a espada ou a magia',
            jefe: 'Algo enorme aproxima-se…',
        },
        pistasTactil: {
            mover: 'Caminha com ◀ ▶',
            sprint: 'Toca duas vezes em ▶ para correr a toda a velocidade',
            saltar: 'Salta com ▲. Mantém premido para ir mais alto',
            atacar: 'Toca em ⚔ para atacar com a espada',
            bajar: '▼ para descer de uma plataforma',
            doble: 'Toca em ▲ outra vez no ar para o salto duplo',
        },
        poderes: {
            pluma: ['Salto duplo!', 'Prime ↑ outra vez no ar'],
            orbe: ['Orbe arcano!', 'Prime X para lançar magia'],
            escudo: ['Escudo!', 'Protege-te de um golpe'],
            pocion: ['+1 coração', ''],
        },
        poderesTactil: { pluma: 'Toca em ▲ outra vez no ar', orbe: 'Toca em ✦ para lançar magia' },
        control: 'Ponto de controlo!',
        jefe: 'REI SLIME',
        completado: 'Nível concluído!',
        monedas: 'Moedas', enemigos: 'Inimigos', tiempo: 'Tempo', muertes: 'Derrotas', puntos: 'Pontos',
        estrellas: ['Concluir o nível', '80% das moedas', 'Sem ser derrotado'],
        siguiente: 'Nível seguinte', menu: 'Menu', reintentar: 'Repetir nível', verFinal: 'Continuar',
        pausa: 'Pausa', reanudar: 'Continuar', reiniciar: 'Reiniciar nível', salir: 'Menu principal',
        derrota: 'Derrotado!', vuelves: 'Voltas ao último ponto de controlo',
        finTitulo: 'Salvaste a floresta!',
        finTexto: 'O Rei Slime caiu e a luz volta a cada recanto.',
        totalPuntos: 'Pontos totais', totalEstrellas: 'Estrelas', gracias: 'Obrigado por jogares',
        creditos: 'Jogo: Victor Fernandes · Gráficos: Legacy Fantasy (Anokolisa) · Fonte: Pixelify Sans',
    },
};

const TXT = TEXTOS[IDIOMA];

/** Pista de tutorial adaptada a teclado o pantalla táctil. */
function pista(clave) {
    if (TouchControls.enabled && TXT.pistasTactil[clave]) return TXT.pistasTactil[clave];
    return TXT.pistas[clave];
}

/** Texto de un poder (título y descripción), adaptado a la pantalla táctil. */
function textoPoder(clave) {
    const [titulo, desc] = TXT.poderes[clave];
    return [titulo, (TouchControls.enabled && TXT.poderesTactil[clave]) || desc];
}
