const kb = require('./keyboards-buttons')

module.exports= {
    home: [[kb.home.films, kb.home.cinemas], [kb.home.favorites]],
    films: [[kb.films.random], [kb.films.action, kb.films.comedy], [kb.back]],
    cinemas: [[{text: 'Отправить местополение', request_location: true}], [kb.back]]
}