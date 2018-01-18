const TelegramBot = require('node-telegram-bot-api');
const config = require('./config');
const helper = require('./helper');
const kb = require('./keyboards-buttons')
const keyboard = require('./keyboards')
const mongoose = require('mongoose')
const database = require('./database.json')
const geolib = require('geolib')
const _ = require('lodash')
//console.log(_)
require('./film.model')
require('./cinema.models')
require('./user.mmodel')
const http = require('http')
const serverhttp = http.createServer((req, res)=>{
        res.writeHead(200, {'Content-Type': 'text/plain'})
        res.write('hello')
        res.end()
}).listen(process.env.PORT || 5000)
const actionType = {
    toogleFavFilm: 'tff',
    showCinemas: 'sc',
    showCinemasMap: 'scm',
    showFilms: 'sf'
}
helper.started();
mongoose.Promise = global.Promise
mongoose.connect(config.DB_URL, {
    useMongoClient: true
}).then(() => {
    console.log('connected')
}).catch(e => {
    console.log(e)
})
const Films = mongoose.model('film')
const Cinemas = mongoose.model('cinemas')
const Users = mongoose.model('users')
/////////////////////////////////////////////////////////////////
/*database.films.map(f=>{
    new Films(f).save()
console.log(f)
})*/
/*database.cinemas.map(f=>{
    new Cinemas(f).save().catch(e=>console.log(e))
console.log(f)
})*/
/*Films.find().then(persons=>{
    persons.map(person=>{
        console.log(person)
    })
})*/
/*Cinemas.find().then(persons=>{
    persons.map(person=>{
        console.log(person)
    })
})*/
//////////////////////////////////////////////////////////////////

const bot = new TelegramBot(config.TOKEN, {
    polling: true
})

bot.on('message', msg => {
    const chatId = helper.chatId(msg)
    switch (msg.text) {
        case kb.home.favorites:
            showFavoriteFilms(chatId, msg.from.id)
            break;
        case kb.films.action:
            sendFilmsByQuery(chatId, { type: 'action' })
            break;
        case kb.films.comedy:
            sendFilmsByQuery(chatId, { type: 'comedy' })
            break;
        case kb.films.random:
            sendFilmsByQuery(chatId, {})
            break;
        case kb.home.cinemas:
            bot.sendMessage(chatId, `Отправить местоположение`, {
                reply_markup: {
                    keyboard: keyboard.cinemas
                }
            })
            break;
        case kb.back:
            bot.sendMessage(chatId, 'ВЫберите действие', {
                reply_markup: {
                    keyboard: keyboard.home
                }
            })
            break;
        case kb.home.films:
            bot.sendMessage(chatId, 'Выберите жанр', {
                reply_markup: {
                    keyboard: keyboard.films
                }
            })
            break;
    }
    if (msg.location)
        getCinemas(chatId, msg.location)
})

bot.onText(/\/start/, msg => {
    const text = `Здравствуйте, ${msg.from.first_name}\nВыберите команду для начала работы`
    bot.sendMessage(helper.chatId(msg), text, {
        reply_markup: {
            keyboard: keyboard.home
        }
    })
})

bot.onText(/\/f(.+)/, (msg, [source, match]) => {
    const uuid = helper.getUiid(source)
    const chatId = helper.chatId(msg)
    Promise.all([
        Users.findOne({telegramId: msg.from.id}),
        Films.findOne({ uuid })
    ]).then(([user, film])=>{
        let isFav = false
        if(user)
            isFav = user.films.indexOf(film.uuid) !== -1
        const favText = isFav?'Удалить из избранного':'Добавить в избранное'
        //console.log(isFav)
        const caption = `Название: ${film.name}\nГод: ${film.year}\nРейтинг: ${film.rate}\nДлительность: ${film.length}\nСтрана: ${film.country}`
                bot.sendPhoto(chatId, film.picture, {
                    caption,
                    reply_markup: {
                        inline_keyboard: [
                            [
                                {
                                    text: favText,
                                    callback_data: JSON.stringify({
                                        type: actionType.toogleFavFilm,
                                        filmUuid: film.uuid,
                                        isFav: isFav
                                    })
                                }, {
                                    text: 'Кинотеатры',
                                    callback_data: JSON.stringify({
                                        type: actionType.showCinemas,
                                        cinemasuuid: film.cinemas
                                    })
                                }
                            ], [
                                {
                                    text: `Кинопоиск ${film.name}`,
                                    url: film.link
                                }
                            ]

                        ]
                    }
                })
    })
})

bot.onText(/\/c(.+)/, (msg, [source, match]) => {
    const uuid = helper.getUiid(source)
    const chatId = helper.chatId(msg)
    Cinemas.findOne({ uuid }).then((cinema) => {
        //console.log(cinema)
        bot.sendMessage(chatId, `Кинотеатр ${cinema.name}`, {
            reply_markup: {
                inline_keyboard: [
                    [{
                        text: cinema.name,
                        url: cinema.url
                    },
                    {
                        text: 'Показать на карте',
                        callback_data: JSON.stringify({
                            type: actionType.showCinemasMap,
                            lat: cinema.location.latitude,
                            lon: cinema.location.longitude
                        })
                    }
                    ],
                    [
                        {
                            text: 'Показать фильмы',
                            callback_data: JSON.stringify({
                                type: actionType.showFilms,
                                filmUuid: cinema.films
                            })
                        }
                    ]
                ]
            }
        })
    })
})

bot.on('callback_query', query => {
    const userID = query.from.id
    let data
    try {
        data = JSON.parse(query.data)
    }
    catch (e) {
        throw new Error('data не объект')
    }
    const { type } = data
    //console.log(type)
    switch (type) {
        case actionType.showCinemas:
            sendCinemasByQuery(userID, {uuid: {'$in': data.cinemasuuid}})
            break
        case actionType.showCinemasMap:
            const {lat, lon} = data
            bot.sendLocation(query.message.chat.id, lat, lon)
            break
        case actionType.showFilms:
            sendFilmsByQuery(userID, {uuid: {'$in': data.filmUuid}})
            break
        case actionType.toogleFavFilm:    
            toogleFavoriteFilm(userID, query.id, data)
            break
    }
})
bot.on('inline_query', query=>{
    
    Films.find({}).then(films=>{
        //console.log(query)
        const results = films.map(f=>{
            return {
                id: f.uuid,
                type: 'photo',
                photo_url: f.picture,
                thumb_url: f.picture,
                caption: `Название: ${f.name}\nГод: ${f.year}\nРейтинг: ${f.rate}\nДлительность: ${f.length}\nСтрана: ${f.country}`,
                reply_markup: {
                    inline_keyboard: [[
                        {
                            text: `Кинопоиск ${f.name}`,
                            url: f.link
                        }]
                    ]
                }
            }
        })
        //console.log(results)
        bot.answerInlineQuery(query.id, results, {
            cache_time: 0
        })
    })
})

///////////////////////////////////////////////////////////////////////////

function sendFilmsByQuery(chatId, query) {
    Films.find(query).then(films => {
        const html = films.map((film, index) => {
            return `<b>${index + 1}</b> ${film.name} - /f${film.uuid}`
        }).join('\n')
        sendHTML(chatId, html, 'films')
    })

}

function sendHTML(chatId, html, kbName = null) {
    options = {
        parse_mode: 'HTML'
    }
    if (kbName)
        options.reply_markup = {
            keyboard: keyboard[kbName]
        }

    bot.sendMessage(chatId, html, options)
}
function getCinemas(chatId, location) {
    Cinemas.find().then(cinemas => {
        cinemas.map(cinema => {
            cinema.distance = geolib.getDistance(location, cinema.location) / 1000
            cinemas = _.sortBy(cinemas, 'distance')
        })
        const html = cinemas.map((c, i) => {
            return `<b>${i + 1}</b> ${c.name} <em>Расстояние</em> <b>${c.distance}</b> /c${c.uuid}`
        }).join('\n')
        sendHTML(chatId, html, 'home')
        //console.log(cinemas)
    })
}
function toogleFavoriteFilm(userID, queryId, {filmUuid, isFav}){
    let userPromise
    Users.findOne({telegramId: userID}).then(user=>{
        //console.log(user)
        if(user){
            if(isFav)
                user.films = user.films.filter(fUuid=>{
                   return fUuid !==  filmUuid
                })
            else
                user.films.push(filmUuid)
            userPromise = user
        }
        else
            userPromise = new Users({
                telegramId: userID,
                films: [filmUuid]
            })
        const answerText = isFav?'Удалено':'Добавлено'
        userPromise.save().then(_=>{
            bot.answerCallbackQuery({
                callback_query_id: queryId,
                text: answerText
            })
        }).catch(e=>console.log(e))
    }).catch(e=>console.log(e))
}
function showFavoriteFilms(chatId, telegramId){
    Users.findOne({telegramId}).then(user=>{
        //console.log(user)
        if(user)
            Films.find({uuid: {'$in': user.films}}).then(films=>{
                let html
                if(films.length)
                    html = films.map((f,i)=>{
                        return `<b>${i+1}</b> <em>${f.name}</em> ${f.rate} /f${f.uuid}`
                    }).join('\n')
                else
                    html = 'Вы пока еще ничего не доабвили'
                sendHTML(chatId, html, 'home')
            })
        else
            sendHTML(chatId, 'Вы пока еще ничего не доабвили', home)
    }).catch(e=>console.log(e))
}
function sendCinemasByQuery(userID, query){
    Cinemas.find(query).then(cinemas=>{
        const html = cinemas.map((c, i)=>{
            return `<b>${i+1}</b> ${c.name} /c${c.uuid}`
        }).join('\n')
        sendHTML(userID, html, 'home')
    })
}