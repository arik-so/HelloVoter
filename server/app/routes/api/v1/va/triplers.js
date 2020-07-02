import { Router } from 'express';
import neo4j from 'neo4j-driver';

import { ov_config } from '../../../../lib/ov_config';

import {
  _204, _400, _401, _403, _404, _500, geoCode, validateEmpty
} from '../../../../lib/utils';

import { serializeTripler, serializeNeo4JTripler } from './serializers';

import { v4 as uuidv4 } from 'uuid';

async function createTripler(req, res) {
  let new_tripler = null

  try {
    let existing_tripler = await req.neode.first('Tripler', 'phone', req.body.phone);
    if (existing_tripler) {
      return _400(res, "Tripler with this data already exists");
    }

    if (!validateEmpty(req.body, ['first_name', 'phone', 'address'])) {
      return _400(res, "Invalid payload, tripler cannot be created");
    }

    let coordinates = await geoCode(req.body.address);
    if (coordinates === null) {
      return _400(res, "Invalid address, tripler cannot be created");
    }

    const obj = {
      id: uuidv4(),
      first_name: req.body.first_name,
      last_name: req.body.last_name || null,
      phone: req.body.phone,
      email: req.body.email || null,
      address: JSON.stringify(req.body.address),
      triplees: !req.body.triplees ? null : JSON.stringify(req.body.triplees),
      location: {
        latitude: parseFloat(coordinates.latitude, 10),
        longitude: parseFloat(coordinates.longitude, 10)
      },
      status: 'unconfirmed'
    }

    new_tripler = await req.neode.create('Tripler', obj);
  } catch(err) {
    req.logger.error("Unhandled error in %s: %j", req.url, err);
    return _500(res, 'Unable to create tripler');
  }
  return res.json(serializeTripler(new_tripler));
}

async function fetchAllTriplers(req, res) {
  const collection = await req.neode.model('Tripler').all();
  let models = [];
  for (var index = 0; index < collection.length; index++) {
    let entry = collection.get(index);
    models.push(serializeTripler(entry))
  }
  return res.json(models);
}

async function suggestTriplers(req, res) {
  let collection = await req.neode.query()
    .match('a', 'Ambassador')
    .where('a.id', req.user.get('id'))
    .match('t', 'Tripler')
    .whereRaw('distance(t.location, a.location) <= 10000') // distance in meters (10km)
    .return('t')
    .execute()

  let models = [];
  for (var index = 0; index < collection.records.length; index++) {
    let entry = collection.records[index]._fields[0].properties;
    models.push(serializeNeo4JTripler(entry));
  }
  return res.json(models);
}

async function fetchTripler(req, res) {
  let ambassador = req.user;
  let tripler = null;
  ambassador.get('claims').forEach((entry) => { if (entry.otherNode().get('id') === req.params.triplerId) { tripler = entry.otherNode() } } );
  
  if (!tripler) {
    return _400(res, "Invalid triper id");
  }
  return res.json(serializeTripler(tripler));
}

async function updateTripler(req, res) {
  let found = null;
  found = await req.neode.first('Tripler', 'id', req.params.triplerId);
  if (!found) return _404(res, "Tripler not found");

  if (req.body.phone) {
    let existing_tripler = await req.neode.first('Tripler', 'phone', req.body.phone);
    if(existing_tripler && existing_tripler.get('id') !== found.get('id')) {
      return _400(res, "Tripler with this phone number already exists");
    }
  }

  let whitelistedAttrs = ['first_name', 'last_name', 'date_of_birth', 'phone', 'email'];

  let json = {};
  for (let prop in req.body) {
    if (whitelistedAttrs.indexOf(prop) !== -1) {
      json[prop] = req.body[prop];
    }
  }

  if (req.body.address) {
    let coordinates = await geoCode(req.body.address);
    if (coordinates === null) {
      return _400(res, "Invalid address, tripler cannot be updated");
    }
    json.address = JSON.stringify(req.body.address);
    json.location = new neo4j.types.Point(4326, // WGS 84 2D
                                           parseFloat(coordinates.longitude, 10),
                                           parseFloat(coordinates.latitude, 10));
  }

  if (req.body.triplees) {
    json.triplees = JSON.stringify(req.body.triplees);
  }

  let updated = await found.update(json);
  return res.json(serializeTripler(updated));
}

async function startTriplerConfirmation(req, res) {
  let ambassador = req.user;
  let tripler = null;
  ambassador.get('claims').forEach((entry) => { if (entry.otherNode().get('id') === req.params.triplerId) { tripler = entry.otherNode() } } );
  
  if (!tripler) {
    return _400(res, "Invalid triper id");
  }
  else if (tripler.get('status') !== 'unconfirmed') {
    return _400(res, "Invalid status, cannot proceed")
  }

  let triplees = req.body.triplees;
  if (!triplees || triplees.length !== 3) {
    return _400(res, 'Insufficient triplees, cannot start confirmation')
  }

  let phone = req.body.phone || tripler.get('phone');

  // TODO send SMS
  await tripler.update({ triplees: JSON.stringify(triplees), status: 'pending', phone: phone });
  return _204(res);
}

async function remindTripler(req, res) {
  let ambassador = req.user;
  let tripler = null;
  ambassador.get('claims').forEach((entry) => { if (entry.otherNode().get('id') === req.params.triplerId) { tripler = entry.otherNode() } } );
  
  if (!tripler) {
    return _400(res, "Invalid triper id");
  }
  else if (tripler.get('status') !== 'pending') {
    return _400(res, "Invalid status, cannot proceed")
  }

  // TODO send SMS
  return _204(res);
}

module.exports = Router({mergeParams: true})
// TODO admin api
.post('/triplers', (req, res) => {
  if (!req.user) return _401(res, 'Permission denied.');
  if (!req.user.get('admin')) return _403(res, "Permission denied.");;
  return createTripler(req, res);
})
.put('/triplers/:triplerId', (req, res) => {
  if (!req.user) return _401(res, 'Permission denied.');
  if (!req.user.get('admin')) return _403(res, "Permission denied.");;
  return updateTripler(req, res);
})
.get('/triplers', (req, res) => {
  if (!req.user) return _401(res, 'Permission denied.');
  // temporarily removing admin restriction so Tomaz can pretend it is /suggest-triplers
  // if (!req.user.get('admin')) return _403(res, "Permission denied.");;
  return fetchAllTriplers(req, res);
})

.get('/suggest-triplers', (req, res) => {
  if (!req.user) return _401(res, 'Permission denied.');
  // David working on it
  return suggestTriplers(req, res);
})
.put('/triplers/:triplerId/start-confirm', (req, res) => {
  if (!req.user) return _401(res, 'Permission denied.');
  return startTriplerConfirmation(req, res);
})
.put('/triplers/:triplerId/remind', (req, res) => {
  if (!req.user) return _401(res, 'Permission denied.');
  return remindTripler(req, res);
})
.get('/triplers/:triplerId', (req, res) => {
  if (!req.user) return _401(res, 'Permission denied.');
  return fetchTripler(req, res);
})