var path = require('path');
var bodyParser = require('body-parser');
var express = require('express');
var webpack = require('webpack');
var config = require('./webpack.config.dev.js');
var fs = require('fs');
var patreon = require('patreon');
var Datastore = require('nedb-promises');
const nodemailer = require('nodemailer');
const got = require('got');

var app = express();
var compiler = webpack(config);
var db = Datastore.create({ filename: 'data.db', autoload: true });
db.persistence.setAutocompactionInterval(1000 * 60 * 60 * 24);

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.json());
app.use(require('webpack-hot-middleware')(compiler));

app.use(require('webpack-dev-middleware')(compiler, {
  noInfo: true,
  publicPath: config.output.publicPath
}));

app.post('/api/checksubs', async function(req, res){

  let rawdata = fs.readFileSync('sec.json');
  var auth = JSON.parse(rawdata);
  patreonOAuthClient = patreon.oauth(auth.id, auth.sec);
  
  patreonOAuthClient.refreshToken(auth.refresh).then(response => {
    var tokens = response;
    console.log(tokens);
    auth.refresh = tokens.refresh_token;
    let newData = JSON.stringify(auth);
    fs.writeFileSync('sec.json', newData);

    request({
      url: 'https://www.patreon.com/api/oauth2/v2/campaigns/149848?include=tiers&fields%5Btier%5D=title,remaining',
      headers : {
        Authorization: 'Bearer ' + tokens.access_token
      }
    }, (err, result, body) => {
      if (err) return console.log(err);
      body = JSON.parse(body);
      var tierlist = body.included;
      for (i = 0; i < tierlist.length; i++)
      {
        console.log(tierlist[i].attributes);
      }
    });

  }).catch(err => {
    console.log(err);
  });
  
  res.sendStatus(200);
});

async function GetTokens()
{
  let rawdata = fs.readFileSync('sec.json');
  var auth = JSON.parse(rawdata);
  patreonOAuthClient = patreon.oauth(auth.id, auth.sec);

  patreonOAuthClient.refreshToken(auth.refresh).then(response => {
    var tokens = response;
    console.log(tokens);
    auth.refresh = tokens.refresh_token;
    let newData = JSON.stringify(auth);
    fs.writeFileSync('sec.json', newData);
    return tokens;

  }).catch(err => {
    console.log(err);
    return {access_token: "err"};
});
}

async function GetAvailableTiers(access_token)
{
  var apiUrl = 'https://www.patreon.com/api/oauth2/v2/campaigns/149848?include=tiers&fields%5Btier%5D=title,remaining';
  var data = await got(apiUrl, {
    headers: {
      Authorization: 'Bearer ' + access_token
    }
  });
  var body = JSON.parse(data);
  return body;
}

async function UpdateSubscriptions(address, selected)
{
  var result;
  if (selected[0].includes("Unsubscribe"))
  {
    result = await db.remove({ email: address }, { multi: true });
    console.log(result);
    return {text: "You have been unsubscribed from all lists."};
  }
  
  result = await db.update({ email: address }, { tiers: selected });
  if (result == 1) 
  {
    return {text: "Your preferences have been updated."};
  }

  var sub = 
  {
    email: address,
    tiers: selected
  };

  await db.insert({ doc: sub });
  return {text: "Your preferences have been saved."}; 

}

function GetSubscriptions(tiers)
{

}

app.post('/api/subscribe', function(req, res){
  var email = req.body.email;
  let response = await this.UpdateSubscription(email.toLowerCase(), req.body.selected);
  res.send(response);
});

app.post('/api/subModify', function(req, res){
  res.status(200);
  res.send();
  
  request.get('https://www.patreon.com/rtil/posts', function (err, res, body) {
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

app.listen(process.env.PORT || 2222, function(err) {
  if (err) {
    console.log(err);
    return;
  }

  console.log('Listening at http://localhost:2222');
});