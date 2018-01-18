var os = require("os");

// Порядок байт
console.log('endianness : ' + os.endianness());

// тип ОС
console.log('type : ' + os.type());

// платформа ОС
console.log('platform : ' + os.platform());

// Общий объем системной памяти
console.log('total memory : ' + os.totalmem() + " bytes.");

// Общий объем свободной системной памяти
console.log('free memory : ' + os.freemem() + " bytes.");

// Общий объем свободной системной памяти
console.log('free memory : ' + os.release()  + " bytes.");