var path = require('path');
var bodyParser = require('body-parser');
var express = require('express');
var webpack = require('webpack');
var config = require('./webpack.config.dev.js');
var $ = require('cheerio');
var request = require('request');
var fs = require('fs');
const nodemailer = require('nodemailer');
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./data.db');
const tiers = ["$15 or more per month (sold out!)", "$25 or more per month (sold out!)", "$50 or more per month (sold out!)", "$100 or more per month (sold out!)", "$400 or more per month (sold out!)"];

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
  var email = req.body.email;
  var sql;
  var sqlEnd;
  db.run("DELETE FROM SUBSCRIPTIONS WHERE Email = '" + email + "'");
  
  if (req.body.selected.length > 0 && req.body.selected[0].includes("Unsubscribe"))
  {
    res.send({text: "You have unsubscribed from all lists."});
    return;
  }

  for (i = 0; i < req.body.selected.length; i++)
  {
    if (req.body.selected[i].includes("15"))
    {
      sqlEnd = 15;
    }
    else if (req.body.selected[i].includes("25"))
    {
      sqlEnd = 25;
    }
    else if (req.body.selected[i].includes("50"))
    {
      sqlEnd = 50;
    }
    else if (req.body.selected[i].includes("100"))
    {
      sqlEnd = 100;
    }
    else if (req.body.selected[i].includes("400"))
    {
      sqlEnd = 400;
    }

    sql = "INSERT INTO SUBSCRIPTIONS (Email, Tier) VALUES ('v1', v2)";
    sql = sql.replace("v1", email).replace('v2', sqlEnd);
    db.run(sql);
  }
  res.send({text: "Your preferences have been updated."});
});

app.post('/api/subModify', function(req, res){
  res.status(200);
  res.send();
  
  request.get('https://www.patreon.com/rtil', function (err, res, body) {
    var parsedHTML = $.load(body);
    var tiersAvailable = [];
    var sql;

    for (i = 0; i < tiers.length; i++)
    {
      if (!parsedHTML.text().includes(tiers[i]))
      {
        tiersAvailable.push(tiers[i]);
      }
    }

    var j;
    var mailText;
    for (i = 0; i < tiersAvailable.length; i++)
    {
      j = tiers.indexOf(tiersAvailable[i]);
      switch(j)
      {
        case 0:
          j = 15;
          mailText = "$15 - The Ballot Box ";
          break;

        case 1:
          j = 25;
          mailText = "$25 - Sketch Requests ";
          break;

        case 2:
          j = 50;
          mailText = "$50 - Critique ";
          break;

        case 3:
          j = 100;
          mailText = "$100 - Online Class ";
          break;

        case 4:
          j = 400;
          mailText = "$400 - Exclusive Commissions ";
          break;
      }

      sql = "SELECT email, tier FROM SUBSCRIPTIONS WHERE tier = " + j;
      db.each(sql, function(err, row) 
      {
        let transporter = nodemailer.createTransport({
          host: 'REPLACEME',
          port: '465',
          secure: true,
          auth: {
            user: 'REPLACEME',
            pass: 'REPLACEME'
          }
        });
        var mail = {
          from: 'REPLACEME',
          to: row.Email,
          subject: "A sketch tier you're waiting for is available!",
          text: getMailText(row.Tier) + "has just become available on rtil's Patreon!"
        }
        transporter.sendMail(mail);
      });

    }

  });

});

function getMailText(tier)
{
  switch(tier)
      {
        case 15:
          return "$15 - The Ballot Box ";

        case 25:
          return "$25 - Sketch Requests ";

        case 50:
          return "$50 - Critique ";

        case 100:
          return "$100 - Online Class ";

        case 400:
          return "$400 - Exclusive Commissions ";
      }
}

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