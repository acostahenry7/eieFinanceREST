const fs = require('fs')
const express = require('express')
const config = require('./server/config.js')
const https = require('https')

const app = config(express())

const db = require('./models')


options = {
    key: fs.readFileSync('/home/henry/Documents/platzi/react-courses/curso-intro-react-native/eieFinance/src/example.key'),
    cert: fs.readFileSync('/home/henry/Documents/platzi/react-courses/curso-intro-react-native/eieFinance/src/example.crt')
}


app.listen(app.get('port') , () => {
    console.log(`Listening on port ${app.get('port')}`);
})

db.sequelize.sync()
