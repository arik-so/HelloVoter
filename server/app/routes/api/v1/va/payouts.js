import { Router } from 'express';
import stripeSvc from '../../../../services/stripe';
import ambassadorSvc from '../../../../services/ambassadors';
import triplerSvc from '../../../../services/triplers';
import { error } from '../../../../services/errors';

import {
  _204, _401, _403
} from '../../../../lib/utils';

import { ov_config } from '../../../../lib/ov_config';

import stripe from './stripe';

function stripePayout(req) {
  return req.query.stripe && req.query.stripe.toLowerCase() === 'true' && ov_config.payout_stripe;
}

function paypalPayout(req) {
  return req.query.paypal && req.query.paypal.toLowerCase() === 'true' && ov_config.payout_paypal;
}

module.exports = Router({mergeParams: true})
.post('/payouts/account', async (req, res) => {
  if (!req.authenticated) return _401(res, 'Permission denied.')
  
  if (stripePayout(req)) {
    return stripe.createStripeAccount(req, res);
  }
  else if (paypalPayout(req)) {
    return error(400, res, 'Not implemented.');
  }
  else {
    return error(400, res, 'Payouts not supported.');
  }  
})
.post('/payouts/test-account', async (req, res) => {
  if (!req.authenticated) return _401(res, 'Permission denied.')
  if (!req.admin) return _403(res, "Permission denied.");

  if (stripePayout(req)) {
    return stripe.createStripeTestAccount(req, res);
  }
  else if (paypalPayout(req)) {
    return error(400, res, 'Not implemented.');
  }
  else {
    return error(400, res, 'Payouts not supported.');
  } 
})
.put('/payouts/disburse', async (req, res) => {
  if (!req.authenticated) return _401(res, 'Permission denied.')
  if (!req.admin) return _403(res, "Permission denied.");
  
  let ambassadorId = req.query['ambassador-id'];
  let triplerId = req.query['tripler-id'];

  if (!ambassadorId || !triplerId) {
    return error(400, res, 'Invalid parameters, cannot disburse.');
  }

  let ambassador = await ambassadorSvc.findById(ambassadorId);
  if (!ambassador) {
    return error(400, res, 'Invalid ambassador, cannot disburse.');
  }

  let tripler = await triplerSvc.findById(triplerId);
  if (!tripler) {
    return error(400, res, 'Invalid tripler, cannot disburse.');
  }

  // TODO: See what the default account is, and invoke appropriate payment provider api

  try {
    await stripeSvc.disburse(ambassador, tripler);
  }
  catch (err) {
    req.logger.error('Unable to disburse money to ambassador (%s) for tripler (%s): %s', ambassador.get('phone'), tripler.get('phone'), err);
    return error(500, res, 'Unable to disburse money, please check logs.');
  }

  return _204(res);
})
.put('/payouts/settle', async (req, res) => {
  if (!req.authenticated) return _401(res, 'Permission denied.')
  if (!req.admin) return _403(res, "Permission denied.");
  
  let ambassadorId = req.query['ambassador-id'];
  let triplerId = req.query['tripler-id'];

  if (!ambassadorId || !triplerId) {
    return error(400, res, 'Invalid parameters, cannot settle.');
  }

  let ambassador = await ambassadorSvc.findById(ambassadorId);
  if (!ambassador) {
    return error(400, res, 'Invalid ambassador, cannot settle.');
  }

  let tripler = await triplerSvc.findById(triplerId);
  if (!tripler) {
    return error(400, res, 'Invalid tripler, cannot settle.');
  }

  // TODO: See what the default account is, and invoke appropriate payment provider api

  try {
    await stripeSvc.settle(ambassador, tripler);
  }
  catch (err) {
    req.logger.error('Unable to settle for ambassador (%s) for tripler (%s): %s', ambassador.get('phone'), tripler.get('phone'), err);
    return error(500, res, 'Unable to settle, please check logs.');
  }

  return _204(res);
});
