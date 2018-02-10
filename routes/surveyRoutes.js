const mongoose = require('mongoose');
const requireLogin = require('../middlewares/requireLogin');
const requireCredits = require('../middlewares/requireCredits');
const Mailer = require('../services/Mailer');
const surveyTemplate = require('../services/emailTemplates/surveyTemplate');
const _ = require('lodash');
const path = require('path-parser');
const { URL } = require('url');

const Survey = mongoose.model('surveys');

module.exports = app => {
  app.get('/api/surveys', requireLogin, async (req, res) => {
    const surveys = await Survey.find({ _user: req.user.id }).select({
      recipients: false
    });

    res.send(surveys);
  });

  app.get('/api/surveys/thanks', (req, res) => {
    res.send('Thanks For voting');
  });

  app.post('/api/surveys', requireLogin, requireCredits, async (req, res) => {
    const { title, subject, body, recipients } = req.body;
    const survey = new Survey({
      title,
      subject,
      body,
      recipients: recipients.split(',').map(email => ({
        email: email.trim()
      })),
      _user: req.user.id,
      dateSent: Date.now()
    });
    //Great place to send email
    const mailer = new Mailer(survey, surveyTemplate(survey));
    try {
      await mailer.send();
      await survey.save();
      req.user.credits -= 1;
      const user = await req.user.save();
      res.send(user);
    } catch (err) {
      res.status(422).send(err);
    }
  });

  app.post('api/surveys/webhooks', (req, res) => {
    const p = new Path('/api/surveys/:surveyId/:choice');
    const events = _.map(req.body, event => {
      const pathname = new URL(event.url).pathname;

      const match = p.test(pathname);

      if (match) {
        return {
          email: event.email,
          surveyId: match.surveyId,
          choice: match.choice
        };
      }
    });

    //remove all undefined from arrays
    const compactEvents = _.compact(events);
    //remove duplicates
    const uniqueEvents = _.uniqBy(compactEvents, 'email', 'surveyId');

    const query = _.each(event => {
      Survey.updateOne(
        {
          _id: surveyId,
          recipients: {
            $elemMatch: { email: email, responded: false }
          }
        },
        {
          $inc: { [choice]: 1 },
          $set: { 'recipients.$.responded': true }
        }
      );
    });
    console.log(uniqueEvents);

    res.send({});
  });
};
