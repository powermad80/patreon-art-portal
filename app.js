var path = require('path');
var bodyParser = require('body-parser');
var express = require('express');
var webpack = require('webpack');
var config = require('./webpack.config.dev.js');
var fs = require('fs');
var patreon = require('patreon');
var schedule = require('node-schedule');
var Datastore = require('nedb-promises');
const nodemailer = require('nodemailer');
const got = require('got');

var app = express();
var compiler = webpack(config);
var db = Datastore.create({ filename: 'data.db', autoload: true });

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.json());
app.use(require('webpack-hot-middleware')(compiler));

app.use(require('webpack-dev-middleware')(compiler, {
  noInfo: true,
  publicPath: config.output.publicPath
}));

// Main function called when webhook endpoint is hit
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

// Uses Patreon library to take stored refresh token and generate
// a new access token to use in requesting campaign info, and store
// the new refresh token for use next time
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

// Takes access token and requests data on all patreon tiers
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

  // For all tiers, find the ones that have limited slots, and
  // are not sold out
  for (var i = 0; i < data.included.length; i++)
  {
    if (data.included[i].attributes.remaining > 0)
    {
      tiers.push(data.included[i].attributes.title);
    }
  }

  return tiers;
}

// Update in database a user's subscription preferences
async function UpdateSubscriptions(address, selected)
{
  var j;
  var result;
  
  // Unsubscribe can only be the sole element in the array, so check if it's that
  // and if so remove all entries for the given email and return
  if (selected[0].includes("Unsubscribe"))
  {
    result = await db.remove({ email: address }, { multi: true });
    return {text: "You have been unsubscribed from all lists."};
  }

  // If the request is not to unsubscribe, format the strings from each
  // selected tier (removing price labels to match with strings provided by Patreon)
  // This makes database operations easier when checking for matching strings.
  for (var i = 0; i < selected.length; i++)
  {
    j = selected[i].indexOf('(');
    selected[i] = selected[i].substring(0, j - 1);
  }
  
  // Try to update an existing entry with the new preferences. If the returned int
  // is 0, then no entries were modified, so user is a new subscriber and must be
  // handled separately
  result = await db.update({ email: address }, { $set: { tiers: selected } });
  if (result == 1) 
  {
    return {text: "Your preferences have been updated."};
  }

  // For new subscribers, create the database entry object using provided data
  var sub = 
  {
    email: address,
    tiers: selected
  };

  // Insert the new entry
  result = await db.insert(sub);
  return {text: "Your preferences have been saved."}; 

}

// Pass in the list of all available tiers
// Function returns all db entries for users subscribed to any item in list
async function GetSubscriptions(tierlist)
{
  return await db.find( { tiers: { $in: tierlist } });
}

// If basically anything unexpected happens, send an email containing
// the error message to the admin's email as defined in email.json
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

// Pass in list of all db entries returned by GetSubscriptions(), and the same
// list of available tiers passed into that function. 
// Sends notification email to all emails passed into it
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
      html: GetMailText(emails[i], tiers)
    }
    transporter.sendMail(mail);
  }
}

// Called for each db entry given to SendMail(), generates individual mail text
// based on the availability status of every tier the user is subscribed to
function GetMailText(email, tiers)
{
  var text = "";
  var html = "";
  for (var i = 0; i < email.tiers.length; i++)
  {
    if (tiers.indexOf(email.tiers[i]) != -1)
    {
      text = text + "<li>" + email.tiers[i] + "</li>";
    }
  }

  html = fs.readFileSync("emailtemplate.txt", "utf8");
  html = html.replace("REPLACEMEWITHLISTITEMS", text);

  return html;
}

// Cron-like task scheduler, just to run a simple task once a day
// Calls GetTokens() to refresh the access token since it isn't permanent
// and can't be generated at-will in code. 

// NeDB's database compaction function appears to be broken, so in its place
// at the same time we run db.loadDatabase(), which manually performs this

var job = schedule.scheduleJob('0 0 1 * * *', async function() {
  try 
  {
    await GetTokens();
    await db.loadDatabase();
  }
  catch (err)
  {
    SendErrorEmail(err);
  }
})

app.post('/api/subscribe', async function(req, res){
  var email = req.body.email;
  let response = await UpdateSubscriptions(email.toLowerCase(), req.body.selected);
  res.send(response);
});

app.post('/api/subModify', function(req, res){
  // Call NotifySubscribers() 30 seconds after the webhook hits
  // Allows buffer time for API data to refresh, and more importantly,
  // giving a very brief grace period for users who are transferring their
  // ownership of a limited tier slot
  setTimeout(function() {
    NotifySubscribers();
  }, 30 * 1000);
  res.status(200);
  res.send();
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