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
  
  var tokens = await patreonOAuthClient.refreshToken(auth.refresh);
  console.log(tokens);
  auth.refresh = tokens.refresh_token;
  let newData = JSON.stringify(auth);
  fs.writeFileSync('sec.json', newData);

  var tierlist = await GetAvailableTiers(tokens.access_token);
    for (i = 0; i < tierlist.length; i++)
    {
      console.log(tierlist[i].attributes);
    }
  
  res.sendStatus(200);
});

async function NotifySubscribers()
{
  try 
  {
    var availableTiers = await GetAvailableTiers(await GetTokens());
    var subscribers = await GetSubscriptions(availableTiers);
    await SendMail(subscribers, availableTiers);
  }
  catch (err)
  {
    SendErrorEmail(err);
  }
}

async function GetTokens()
{
  let rawdata = fs.readFileSync('sec.json');
  var auth = JSON.parse(rawdata);
  patreonOAuthClient = patreon.oauth(auth.id, auth.sec);

  var tokens = await patreonOAuthClient.refreshToken(auth.refresh);
  auth.refresh = tokens.refresh_token;
  let newData = JSON.stringify(auth);
  fs.writeFileSync('sec.json', newData);
  return tokens.access_token;
}

async function GetAvailableTiers(access_token)
{
  var apiUrl = 'https://www.patreon.com/api/oauth2/v2/campaigns/149848?include=tiers&fields%5Btier%5D=title,remaining';
  var site = await got(apiUrl, {
    headers: {
      Authorization: 'Bearer ' + access_token
    }
  });
  var data = JSON.parse(site.body);
  var tiers = [];

  for (var i = 0; i < data.included.length; i++)
  {
    if (data.included[i].attributes.remaining > 0)
    {
      tiers.push(data.included[i].attributes.title);
    }
  }

  return tiers;
}

async function UpdateSubscriptions(address, selected)
{
  var j;
  var result;
  if (selected[0].includes("Unsubscribe"))
  {
    result = await db.remove({ email: address }, { multi: true });
    return {text: "You have been unsubscribed from all lists."};
  }

  for (var i = 0; i < selected.length; i++)
  {
    j = selected[i].indexOf('(');
    selected[i] = selected[i].substring(0, j - 1);
  }
  
  result = await db.update({ email: address }, { $set: { tiers: selected } });
  if (result == 1) 
  {
    return {text: "Your preferences have been updated."};
  }

  var sub = 
  {
    email: address,
    tiers: selected
  };

  result = await db.insert(sub);
  return {text: "Your preferences have been saved."}; 

}

async function GetSubscriptions(tierlist)
{
  return await db.find( { tiers: { $in: tierlist } });
}

function SendErrorEmail(err)
{
  let rawdata = fs.readFileSync('email.json');
  var auth = JSON.parse(rawdata);

  let transporter = nodemailer.createTransport({
    host: auth.host,
    port: auth.port,
    secure: true,
    auth: {
      user: auth.email,
      pass: auth.pass
    }
  });

  var mail = {
    from: auth.email,
    to: auth.err,
    subject: "Unexpected error occurred in rtil subscription site",
    text: err
  }

  transporter.sendMail(mail);
  return;

}

async function SendMail(emails, tiers)
{
  let rawdata = fs.readFileSync('email.json');
  var auth = JSON.parse(rawdata);

  var mail;
  let transporter = nodemailer.createTransport({
    host: auth.host,
    port: auth.port,
    secure: true,
    auth: {
      user: auth.email,
      pass: auth.pass
    }
  });


  for (var i = 0; i < emails.length; i++)
  {
    mail = {
      from: auth.email,
      to: emails[i].email,
      subject: "A Patreon tier you're waiting for is available!",
      text: GetMailText(emails[i], tiers)
    }
    transporter.sendMail(mail);
  }
}

function GetMailText(email, tiers)
{
  var text = "The following tier(s) have become available on rtil's Patreon: \n";
  for (var i = 0; i < email.tiers.length; i++)
  {
    if (tiers.indexOf(email.tiers[i]) != -1)
    {
      text = text + email.tiers[i] + "\n";
    }
  }

  return text;
}

app.post('/api/subscribe', async function(req, res){
  var email = req.body.email;
  let response = await UpdateSubscriptions(email.toLowerCase(), req.body.selected);
  res.send(response);
});

app.post('/api/subModify', function(req, res){
  res.status(200);
  res.send();
  NotifySubscribers();

});

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