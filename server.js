var path = require('path');
var bodyParser = require('body-parser');
var express = require('express');
var webpack = require('webpack');
var config = require('./webpack.config.dev.js');
var fs = require('fs');

var app = express();
var compiler = webpack(config);

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.json());
app.use(require('webpack-hot-middleware')(compiler));

app.use(require('webpack-dev-middleware')(compiler, {
  noInfo: true,
  publicPath: config.output.publicPath
}));

app.post('/api/subscribe', function(req, res){
  console.log(req.body);
  res.send({text: "hi"});
});

app.post('/api/subscriptionevent', function(req, res){
  res.status(200);
  res.send();
  
  fs.writeFileSync('payload.txt', JSON.stringify(req));
  
  /*
  //use imported function for database ops
  
  */

})

app.get('*', function(req, res) {
  res.sendFile(path.resolve(__dirname, 'index.html'));
});

app.listen(process.env.PORT || 5000, function(err) {
  if (err) {
    console.log(err);
    return;
  }

  console.log('Listening at http://localhost:5000');
});