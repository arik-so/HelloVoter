// VotingPlan node definition
//
// Represents a voting plan, or a link that potentially leads to the creation
// of a voting plan; related to the voter who is making the plan and the
// canvasser who provided the link.
//
// This models the situation where an Ambassador canvasses a Tripler as:
// provider: Ambassador -[:PROVIDES_LINK]-> VotingPlan -[:FOR_VOTER]-> voter: Tripler
//
// TODO(ping): This should also be used to model a Tripler canvassing a Triplee:
// provider: Tripler -[:PROVIDES_LINK]-> VotingPlan -[:FOR_VOTER]-> voter: Triplee

module.exports = {
  id: { type: "uuid", primary: true },

  // BallotReady provides a "ballot_id" field (see the "User Data Dictionary").
  // It is uniquely generated each time a user begins their BallotReady flow,
  // so it can also serve as a unique ID for a voting plan created by a voter.
  ballot_id: "string",  // constrained unique

  link_code: { type: "string", required: true },  // constrained unique
  prefill_params: { type: "string", required: true },  // stringified JSON
  create_time: { type: "datetime", required: true },
  last_send_time: "datetime",  // last time we texted this link to the voter

  link_provider: {
    type: "relationship",
    direction: "in",
    relationship: "PROVIDES_LINK",
    target: "Ambassador",
    cascade: "detach",
    required: true,
  },
  voter: {
    type: "relationship",
    direction: "out",
    relationship: "FOR_VOTER",
    target: "Tripler",
    cascade: "detach",
    required: true,
  }
};
