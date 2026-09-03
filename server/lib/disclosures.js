/**
 * What the platform says about the limits of what it carries.
 *
 * A platform that records ministerial standing has to be plain about what a
 * document is and is not, in the place the claim is made, every time. These strings are
 * rendered on the listing, in the application flow and into the issued PDF, so
 * that a person cannot buy a title without having read what it does not do.
 *
 * A church may write its own `disclosure` on an offering. That is added to
 * these, never instead of them.
 */

export const PLATFORM_DISCLOSURES = {
  credential:
    'Kingdom Network records what a church issues. It does not accredit, validate or endorse any church, and it takes no view on what a title should mean. Standing is granted by the issuing church, on its own authority, and is recognised wherever that church is recognised.',

  civilRecognition:
    'What civil authority a credential carries — to solemnise a marriage, to claim a clergy exemption, to be registered as a minister — varies by country and often by state or district. Check the requirements where you intend to serve before relying on this document.',

  invitationLetter:
    'An invitation letter is a supporting document written by a host church. It is not issued by any government, it is not a visa, and it does not guarantee that a visa will be granted. The decision rests entirely with the immigration authority you apply to, which may disregard it.',

  fee:
    'The fee is for the church’s assessment of your application. Paying it begins a process; it does not confer the credential, and the church may decline your application after it has been paid.',

  donation:
    'Gifts are collected by Kingdom Network on behalf of the receiving church and passed to it after the platform’s stated fee. Kingdom Network is not a registered charity and cannot issue tax receipts; ask the receiving church what it can provide.',

  demo:
    'Demonstration content. This listing was written to show how the platform works and does not represent an offer from the church named on it.',
};

/** The full set of statements that must appear with a given listing. */
export const disclosuresFor = (offering, { demo = false } = {}) => {
  const out = [];
  if (demo || offering?.demo) out.push(PLATFORM_DISCLOSURES.demo);
  if (offering?.disclosure) out.push(offering.disclosure);

  if (offering?.type === 'invitation-letter') {
    out.push(PLATFORM_DISCLOSURES.invitationLetter);
  } else {
    out.push(PLATFORM_DISCLOSURES.credential);
    if (['ordination', 'license'].includes(offering?.type)) {
      out.push(PLATFORM_DISCLOSURES.civilRecognition);
    }
  }

  if ((offering?.fee?.amount ?? offering?.price ?? 0) > 0) out.push(PLATFORM_DISCLOSURES.fee);

  return out;
};
