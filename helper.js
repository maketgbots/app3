module.exports = {
    started: ()=>{
        console.log('bot started')
    },
    chatId: (msg)=>{
        return msg.chat.id
    },
    getUiid(source){
        return source.substr(2, source.length)
    }
}