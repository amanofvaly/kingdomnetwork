// [courseSlug, name, avatar, location, rating, title, body, monthsAgo, helpful]
const R = [
  // foundations-of-pastoral-theology
  ['foundations-of-pastoral-theology','Moses Kirabo','p-man-white-vneck','Mbarara, Uganda',5,'The week-mapping assignment changed how I work','I had been telling myself I studied on Mondays. I recorded a real week and I had studied for forty minutes. Rebuilding the week around what I actually said mattered was worth the fee on its own.',2,84],
  ['foundations-of-pastoral-theology','Sarah Achieng','p-woman-yellow','Kisumu, Kenya',5,'Written cases, marked properly','You write your judgement before you see how it was handled. I got two badly wrong and I remember both of them a year later.',5,61],
  ['foundations-of-pastoral-theology','Daniel Rukundo','p-young-man-park','Kigali, Rwanda',5,'Worked entirely on my phone','I am three hours from the nearest town with reliable internet. The audio versions and the small reading packs meant I finished without ever needing a computer.',3,52],
  ['foundations-of-pastoral-theology','Thomas Waweru','p-man-orange-beanie','Nakuru, Kenya',4,'Strong on discipline, thinner on preaching','The discipline and restoration section is the best material I have seen anywhere. The preaching section is short and assumes you will take a preaching course elsewhere.',7,38],
  ['foundations-of-pastoral-theology','Jane Nabirye','p-woman-foliage','Jinja, Uganda',5,'The four failure patterns lecture','I recognised two of them in my own ministry within ten minutes. Uncomfortable and necessary.',1,44],
  ['foundations-of-pastoral-theology','Peter Muriithi','p-man-dark-beard','Nairobi, Kenya',5,'Prepared me for the ordination board','The final assessment is close to what the board actually asks. I went in knowing the shape of it.',9,29],

  // biblical-greek-for-preachers
  ['biblical-greek-for-preachers','Alice Mwangi','p-woman-striped','Eldoret, Kenya',5,'I translated 1 John and I still cannot believe it','I had never studied a language formally. The audio drills are what made it work — I did fifteen minutes on the matatu every morning for four months.',4,127],
  ['biblical-greek-for-preachers','Emmanuel Odongo','p-man-maroon-tee','Gulu, Uganda',5,'The word-study fallacies section is worth the price','I have preached three of those fallacies from a pulpit. Nobody had ever told me.',2,96],
  ['biblical-greek-for-preachers','Grace Wanjiru','p-woman-bun','Nairobi, Kenya',5,'Honest about what it will not do','He says in the first lecture that you will not become fluent and that this is about checking the text. That framing kept me going.',6,71],
  ['biblical-greek-for-preachers','Julian Vasquez','p-man-teal-shirt','San Antonio, USA',4,'Participles section needs another pass','Everything before participles is beautifully paced. Participles come at you fast and I had to rewatch the whole section twice.',3,55],
  ['biblical-greek-for-preachers','Ruth Namutebi','p-woman-hijab','Kampala, Uganda',5,'Aorist finally makes sense','I had been taught "once for all" my whole life. Watching that get taken apart carefully was the single most useful hour.',8,63],

  // intercession-that-lasts
  ['intercession-that-lasts','Kofi Mensah','p-man-white-vneck','Kumasi, Ghana',5,'Our prayer meeting now ends on time','Sounds small. It is not. Attendance doubled in four months because people knew they could come after work and be home by nine.',3,112],
  ['intercession-that-lasts','Abena Osei','p-woman-yellow','Accra, Ghana',5,'The section on where it goes wrong','Elitism in the prayer room is real and I had been part of it without seeing it. That lecture was hard to sit through.',5,88],
  ['intercession-that-lasts','Blessing Adeyemi','p-woman-foliage','Lagos, Nigeria',5,'Practical, not atmospheric','I expected inspiration. I got a rota template, a training path and a record-keeping system. Much more useful.',2,74],
  ['intercession-that-lasts','Samuel Boateng','p-young-man-hoodie','Takoradi, Ghana',4,'Wanted more on leading large gatherings','Excellent on the weekly meeting. Less on what changes when you have four hundred people in the room.',7,31],
  ['intercession-that-lasts','Mercy Owusu','p-woman-red-top','Accra, Ghana',5,'The night watch case study','We were burning the same six people out and calling it devotion. We restructured the rota the week after that lecture.',1,58],

  // systematic-theology-i
  ['systematic-theology-i','Andre Whitmore','p-man-maroon-suit','Houston, USA',5,'The marks are real','I failed the Trinity assessment the first time and had to repeat the module. I was annoyed. I was also, on reflection, not ready. The second attempt was much better work.',4,143],
  ['systematic-theology-i','Lydia Barnes','p-woman-blazer','Atlanta, USA',5,'Primary sources, not summaries','Reading Athanasius in extract rather than reading about Athanasius makes an enormous difference. You see the argument being made.',6,97],
  ['systematic-theology-i','Christopher Nolan','p-man-glasses-coat','Chicago, USA',5,'Twelve weeks, six hours a week, no shortcuts','The three-week unit structure is what let me finish while pastoring. But it is a real workload and you should plan for it.',2,81],
  ['systematic-theology-i','Denise Fowler','p-woman-portrait','Memphis, USA',4,'Dense, and the reading is heavy','No complaints about quality. Be honest with yourself about the reading load before you enrol.',8,46],
  ['systematic-theology-i','Marcus Bell','p-man-smiling-dark','Dallas, USA',5,'The heresy illustrations lecture','Four illustrations I had used from a pulpit, each shown to be a specific historical heresy. I have stopped using all four.',3,105],
  ['systematic-theology-i','Rachel Adeyinka','p-woman-office','Houston, USA',5,'Order actually matters','He explains why the sequence is scripture, then God, then humanity, and by module six you can feel why it could not be any other way.',5,67],

  // the-expository-preaching-method
  ['the-expository-preaching-method','Victor Ramsey','p-man-street','Fort Worth, USA',5,'The eight steps are mechanical and that is the point','For the first month it felt like painting by numbers. By the third month I stopped thinking about it and my preparation time had halved.',3,118],
  ['the-expository-preaching-method','Naomi Clarke','p-woman-denim','Phoenix, USA',5,'Audit your last three sermons','That first assignment is brutal and it is the reason the rest of the course lands.',5,92],
  ['the-expository-preaching-method','Isaac Mbeki','p-man-hoodie-city','Johannesburg, South Africa',5,'Genre section is the strongest part','Preaching law to people not under it, and the Amos worked example. I had been flattening every genre into the same sermon shape.',2,76],
  ['the-expository-preaching-method','Paul Denton','p-man-blue-sweater','Kansas City, USA',4,'Submissions take longer than stated','The three manuscripts are marked properly and the feedback is good, but budget more time than the estimates suggest.',7,41],
  ['the-expository-preaching-method','Hannah Iyer','p-woman-violet','Houston, USA',5,'Application that can be refused','That phrase reframed everything. Most of what I called application was too vague for anyone to disagree with.',4,69],

  // church-operations-blueprint
  ['church-operations-blueprint','Ben Hargrove','p-man-glasses-tee','Houston, USA',5,'Diagnosed our ceiling in week one','We had been praying about a growth plateau for two years. It was the volunteer onboarding process. Fixed in a month.',3,87],
  ['church-operations-blueprint','Tina Okoro','p-woman-yellow','Baltimore, USA',5,'Managing someone who is also a member','Nobody teaches this and everybody faces it. Worth the whole course.',6,64],
  ['church-operations-blueprint','Greg Lawson','p-man-street','Tulsa, USA',4,'US-centric in places','The data protection material assumes a US context. Still useful elsewhere but you will need to check your own jurisdiction.',9,33],
  ['church-operations-blueprint','Fatima Sesay','p-woman-hijab','Newark, USA',5,'You finish with an actual manual','The final submission is a real document you keep using. That is rare.',2,55],

  // pastoral-care-and-crisis-response
  ['pastoral-care-and-crisis-response','Margaret Ellis','p-woman-couch','Clearwater, USA',5,'Eighteen cases, and I got several wrong','Writing your response before seeing the outcome is uncomfortable and it is the most effective teaching method I have encountered.',2,164],
  ['pastoral-care-and-crisis-response','Robert Tanaka','p-man-blue-shirt','Tampa, USA',5,'The suicide section is handled carefully','Direct, unsentimental, and it gave me language I have since had to use. I am grateful for it.',4,138],
  ['pastoral-care-and-crisis-response','Yvonne Baptiste','p-woman-dark-portrait','Miami, USA',5,'The first four minutes of a visit','Such a small idea. It has changed every visit I have made since.',1,102],
  ['pastoral-care-and-crisis-response','Alan Pierce','p-elder-glasses-olive','Sarasota, USA',5,'Thirty years in and I learned things','I have taken funerals for four hundred people. The section on someone you never met still taught me a better approach.',7,89],
  ['pastoral-care-and-crisis-response','Chidinma Eze','p-woman-foliage','Orlando, USA',5,'Referral as a skill','I had treated referral as a failure. Reframing it as a skill with a technique changed how I hold my caseload.',3,95],
  ['pastoral-care-and-crisis-response','Steve Kowalski','p-man-curly-glasses','St Petersburg, USA',4,'Compassion fatigue section could be longer','Everything is strong. The final section names the problem well but I wanted more on what to actually do about it.',5,47],

  // biblical-counselling-in-practice
  ['biblical-counselling-in-practice','Priscilla Nunes','p-woman-office','Largo, USA',5,'Unusually honest about scope','A third of the course is about what you should not attempt. That is exactly right and I have not seen it anywhere else.',3,91],
  ['biblical-counselling-in-practice','Jerome Watts','p-man-smiling-dark','Jacksonville, USA',5,'The referral case','Working through a counsellee who should not be with you, and how to say it, is the most useful hour in the course.',5,73],
  ['biblical-counselling-in-practice','Ana Guerrero','p-woman-red-top','Tampa, USA',5,'Session structure over conversation','I had been having long sympathetic conversations and calling it counselling. There is a model here and it works.',2,66],
  ['biblical-counselling-in-practice','Michael Denny','p-man-teal-shirt','Naples, USA',4,'Practicum requirement is demanding','Be sure you have a supervisor lined up before you enrol. I lost two months finding one.',8,38],

  // marriage-preparation-and-family-ministry
  ['marriage-preparation-and-family-ministry','Rebecca Stone','p-woman-auburn','Bradenton, USA',5,'Money goes first, deliberately','Putting finances in session one surfaced things in three of my last four couples that would never have come up otherwise.',3,78],
  ['marriage-preparation-and-family-ministry','Femi Adebayo','p-man-white-vneck','Houston, USA',5,'The case where he refused','Hearing a pastor describe telling a couple to postpone, and how he did it, was worth the course.',4,64],
  ['marriage-preparation-and-family-ministry','Katie Brennan','p-woman-scarf','Fort Myers, USA',4,'Wanted more on remarriage','The six-session model is excellent for first marriages. Less coverage of couples with previous marriages and children.',7,29],

  // prophetic-foundations
  ['prophetic-foundations','Gideon Marsh','p-man-suit-dark','Pensacola, USA',5,'Gifting and office, separated properly','I had spent fifteen years in circles where those two words were used interchangeably. This course took them apart carefully.',3,124],
  ['prophetic-foundations','Selah Ngozi','p-woman-violet','Destin, USA',5,'Never predict a spouse, a death or a date','That single rule would have prevented most of the damage I have watched happen.',2,108],
  ['prophetic-foundations','Wayne Fuller','p-man-yellow-shirt','Mobile, USA',5,'The manipulation patterns','Five patterns, each named and illustrated. I recognised three from a ministry I used to be part of.',5,86],
  ['prophetic-foundations','Bethany Kraus','p-woman-bun','Tallahassee, USA',4,'Heavier on discipline than phenomena','If you are looking for teaching about prophetic experience itself, this is not really that. It is about accountability. Which I think is right, but know what you are buying.',6,52],
  ['prophetic-foundations','Elijah Boateng','p-young-man-park','Atlanta, USA',5,'Being wrong publicly','Nobody teaches what to do afterwards. This does, and it is the most honest hour in the course.',1,67],

  // ministerial-alignment-and-accountability
  ['ministerial-alignment-and-accountability','Charles Nwafor','p-man-maroon-suit','Santa Rosa Beach, USA',5,'Unsentimental about the terms','Covering is usually described in warm language. This lays out the actual obligations on both sides in writing. Refreshing.',4,58],
  ['ministerial-alignment-and-accountability','Deborah Klein','p-woman-blazer','Panama City, USA',5,'The warning signs section','Questions to ask before aligning, and the red flags. I wish I had seen this before my last covering relationship.',3,71],
  ['ministerial-alignment-and-accountability','Tunde Bakare','p-man-orange-beanie','Houston, USA',4,'Useful for overseers too','I came as a network overseer rather than a candidate and most of it still applied.',8,26],

  // reading-whole-books-of-the-bible
  ['reading-whole-books-of-the-bible','Josh Turner','p-young-man-hoodie','Portland, USA',5,'Reading Romans in one sitting','Seventy-five minutes. I had read Romans dozens of times in fragments and never once seen the argument. It is a completely different book.',2,94],
  ['reading-whole-books-of-the-bible','Marissa Cole','p-woman-window','Seattle, USA',5,'Very little lecturing, a lot of reading','That is exactly what it says it is. If you want lectures, look elsewhere. If you want the habit, this builds it.',4,67],
  ['reading-whole-books-of-the-bible','Nathan Ordaz','p-man-glasses-tee','Denver, USA',4,'Mark in one sitting is a big ask','Eighty minutes straight is harder than it sounds with a young family. Worth it, but plan the evening.',6,35],

  // new-testament-survey
  ['new-testament-survey','Philip Grantham','p-man-glasses-coat','Nashville, USA',5,'The synoptic problem stated fairly','He gives each solution its strongest form before criticising it. That is rarer than it should be.',3,156],
  ['new-testament-survey','Amara Wilson','p-woman-yellow','Louisville, USA',5,'Three-week units saved me','I pastor full time. The unit structure meant a bad fortnight did not derail the whole course.',5,118],
  ['new-testament-survey','Dominic Reyes','p-man-dark-beard','Austin, USA',5,'New perspective without a verdict','He describes the debate accurately and lets you decide. I did not expect that and I appreciated it.',2,97],
  ['new-testament-survey','Helen Ashworth','p-woman-portrait','Charlotte, USA',5,'Evening office hours are real','I emailed at nine on a Sunday expecting nothing and had a reply that night. That is not normal for an online course.',7,84],
  ['new-testament-survey','Gabriel Osei','p-man-white-vneck','Accra, Ghana',4,'Two papers are heavy','The exegetical papers are marked to a graduate standard and take much longer than the estimate. Worth it, but plan.',4,49],
  ['new-testament-survey','Susan Whitlock','p-woman-scarf','Raleigh, USA',5,'Revelation without a newspaper','That lecture alone undid twenty years of bad teaching for me.',1,73],

  // hermeneutics-interpreting-scripture
  ['hermeneutics-interpreting-scripture','Timothy Osei','p-man-maroon-tee','Nashville, USA',5,'It argues back','You submit a reading and it gets challenged. Uncomfortable and enormously effective.',3,102],
  ['hermeneutics-interpreting-scripture','Claire Bonnet','p-woman-violet','Boston, USA',5,'"Just read it plainly" is itself a method','That lecture reframed the entire discipline for me in fifteen minutes.',4,88],
  ['hermeneutics-interpreting-scripture','Andrew Kimani','p-man-blue-shirt','Nairobi, Kenya',5,'The four criteria for testing a reading','I now use them every week. Genuinely portable.',2,76],
  ['hermeneutics-interpreting-scripture','Monica Delgado','p-woman-office','San Diego, USA',4,'Advanced, and it means it','Do not take this as your first course. I did a survey first and still found it demanding.',6,44],

  // church-history-first-five-centuries
  ['church-history-first-five-centuries','Ian Fletcher','p-man-curly-glasses','Nashville, USA',5,'The councils finally make sense','I could never keep Nicaea, Constantinople, Ephesus and Chalcedon straight. Now I can, because she teaches what each one was arguing about.',3,131],
  ['church-history-first-five-centuries','Anjali Prasad','p-woman-hijab','Chennai, India',5,'The eastward section','Persia, Arabia and India. Every other survey I have taken stopped at Rome. This was the reason I enrolled and it did not disappoint.',2,119],
  ['church-history-first-five-centuries','Marcus Lindgren','p-man-blue-sweater','Minneapolis, USA',5,'Nestorius and what he actually said','Watching a caricature get dismantled with primary sources was a highlight.',5,84],
  ['church-history-first-five-centuries','Rosa Iglesias','p-woman-red-top','Miami, USA',4,'Heavy weekly reading','The primary source reader is excellent and it is a lot. Budget accordingly.',8,37],

  // the-preaching-craft
  ['the-preaching-craft','Terrence Ball','p-man-smiling-dark','Boston, USA',5,'Six recordings, six sets of timestamped notes','She watches all of it. The notes are specific to the second. I have never had feedback like it.',3,148],
  ['the-preaching-craft','Priya Sundaram','p-woman-dark-portrait','Providence, USA',5,'Comparing recording one and recording six','I did not believe the difference would be visible. It is embarrassing and it is enormous.',2,127],
  ['the-preaching-craft','Kenneth Aduma','p-man-hoodie-city','Worcester, USA',5,'Silence as structure','I had been terrified of a pause. Learning to use one deliberately changed my delivery more than anything else.',4,96],
  ['the-preaching-craft','Laura Vance','p-woman-striped','Hartford, USA',4,'You must be preaching regularly','Six recordings in the course window is genuinely hard if you only preach monthly. Check your rota first.',7,53],
  ['the-preaching-craft','Owen Brady','p-young-man-blazer','Boston, USA',5,'Receiving criticism without defending','There is a whole lesson on this and I needed it more than any technical material.',1,71],

  // teaching-adults-well
  ['teaching-adults-well','Gail Munroe','p-woman-couch','Cambridge, USA',5,'The participant who answers everything','I have had that person in every class for nine years. There is a technique. It works.',3,68],
  ['teaching-adults-well','Ravi Shankar','p-man-glasses-coat','Boston, USA',5,'Recorded review for teaching, not preaching','Same method, applied to facilitation. Watching myself run a discussion was revealing and awful.',4,55],
  ['teaching-adults-well','Erin Doyle','p-woman-bun','Manchester, USA',4,'Short but dense','Under five hours of teaching. Everything in it earns its place, but I wanted more on curriculum design across a year.',6,31],

  // church-finance-essentials
  ['church-finance-essentials','Colin Mbatha','p-man-street','Atlanta, USA',5,'No accounting background needed and that is true','I am a pastor who signs the returns and understood none of it. I built a chart of accounts in week two.',3,89],
  ['church-finance-essentials','Vivian Park','p-woman-office','Charlotte, USA',5,'The controls section protects people','Segregation of duties in a small church sounds bureaucratic until you realise it exists so no volunteer is ever suspected.',2,77],
  ['church-finance-essentials','Harold Simms','p-elder-bearded-smile','Savannah, USA',5,'Restricted funds','We had been spending a restricted fund on general costs for three years without realising it was a problem. Caught it because of this course.',5,94],
  ['church-finance-essentials','Ngozi Chukwu','p-woman-foliage','Atlanta, USA',4,'US regulatory focus','The principles travel. The specific returns and clergy payroll treatment are US-specific.',9,42],

  // governance-and-safeguarding
  ['governance-and-safeguarding','Leonard Pace','p-man-suit-dark','Atlanta, USA',5,'The founder-as-chair section','Direct, structural and unflinching. Our board restructured within six months of my finishing.',3,113],
  ['governance-and-safeguarding','Amina Yusuf','p-woman-hijab','Decatur, USA',5,'Disclosure: the first hour','Clear, procedural and calm. We rewrote our policy against it.',2,98],
  ['governance-and-safeguarding','Peter Grady','p-man-blue-sweater','Macon, USA',5,'Risks churches consistently miss','A list I have now put in front of our trustees. Four of them applied to us.',4,64],
  ['governance-and-safeguarding','Rosalind Achebe','p-woman-portrait','Atlanta, USA',4,'Assumes some board experience','If you have never sat on a board, do some reading first. The pace assumes familiarity.',7,29],

  // the-bible-from-scratch
  ['the-bible-from-scratch','Wanda Reyes','p-woman-red-top','El Paso, USA',5,'It genuinely assumes nothing','I came to faith at fifty-one and every study I tried used words nobody explained. This one starts with how to find a verse.',2,203],
  ['the-bible-from-scratch','Curtis Bell','p-man-yellow-shirt','Houston, USA',5,'I finished it','I have never finished a course of any kind. The lessons are short and they build. That is the whole trick.',3,178],
  ['the-bible-from-scratch','Linh Tran','p-woman-window','Garland, USA',5,'Audio version got me through','I listened while driving between two jobs. Every lesson has audio. That is why I made it to the end.',1,144],
  ['the-bible-from-scratch','George Adeleke','p-man-maroon-tee','Dallas, USA',5,'The ten things people get wrong','I had believed six of them. Said kindly, without making me feel stupid.',5,121],
  ['the-bible-from-scratch','Patricia Nolan','p-woman-auburn','Fort Worth, USA',4,'Wanted more Old Testament','The New Testament coverage is excellent. The Old Testament is more of a fly-past. I would take a follow-up.',6,58],

  // leading-a-small-group
  ['leading-a-small-group','Ryan Whitlow','p-young-man-hoodie','Plano, USA',5,'Ninety minutes of preparation, no more','I was spending four hours and killing the discussion by over-preparing. She is right.',2,116],
  ['leading-a-small-group','Ify Nwachukwu','p-woman-violet','Irving, USA',5,'The silence you have to sit through','Counting to eight before rescuing the room. It works and it was agony the first three times.',3,93],
  ['leading-a-small-group','Brett Sanders','p-man-teal-shirt','Arlington, USA',4,'Basic, in a good way','If you have led groups for a decade there may not be much new. For a first-year leader it is exactly right.',7,41],

  // hospital-chaplaincy-foundations
  ['hospital-chaplaincy-foundations','Ingrid Sorensen','p-woman-couch','Portland, USA',5,'Serving someone who wants nothing from you','That lecture defines the whole discipline. It is the hardest and most important idea in chaplaincy.',3,87],
  ['hospital-chaplaincy-foundations','Malcolm Reid','p-man-hoodie-city','Eugene, USA',5,'Supporting the staff, who also carry it','I had never considered the nurses. Now it is part of every attendance.',2,74],
  ['hospital-chaplaincy-foundations','Joyce Tembo','p-woman-dark-portrait','Seattle, USA',5,'The ethics section is genuinely rigorous','Capacity, consent and confidentiality inside a clinical team, taught properly rather than gestured at.',5,66],
  ['hospital-chaplaincy-foundations','Frank Delaney','p-elder-glasses-olive','Spokane, USA',4,'Placement is the bottleneck','The taught material is excellent. Securing a supervised placement took me four months and the course does not help much with that.',8,45],

  // prison-ministry-and-ethics
  ['prison-ministry-and-ethics','Andre Colston','p-man-smiling-dark','Salem, USA',5,'Ministry to people who cannot leave','The ethical framing is the heart of this course and I have not seen it addressed anywhere else with this seriousness.',3,79],
  ['prison-ministry-and-ethics','Bev Larkin','p-woman-scarf','Tacoma, USA',5,'Manipulation without cynicism','Holding both at once is the skill, and he teaches it from eleven years of getting it wrong and right.',2,68],
  ['prison-ministry-and-ethics','Hector Ramos','p-man-street','Boise, USA',5,'Release planning','The first month out is a cliff and our church was doing nothing about it. We have a programme now.',4,57],
  ['prison-ministry-and-ethics','Danielle Foy','p-woman-bun','Portland, USA',4,'Advanced, as stated','Not a starting point. Do a general chaplaincy or pastoral care course first.',9,26],

  // planting-a-rural-congregation
  ['planting-a-rural-congregation','Robert Ssentongo','p-man-orange-beanie','Mbale, Uganda',5,'The closing-well section','Nobody teaches how to close a plant. I needed it two years ago and it would have saved a lot of pain.',3,72],
  ['planting-a-rural-congregation','Esther Kamau','p-woman-foliage','Meru, Kenya',5,'Registration checklists are worth it alone','Four jurisdictions, step by step. Saved me weeks.',2,58],
  ['planting-a-rural-congregation','John Byaruhanga','p-young-man-park','Fort Portal, Uganda',5,'Teaching giving without shaming the poor','A whole lecture on this. It is the question I get asked most and I had no good answer.',5,49],

  // planting-in-a-new-city
  ['planting-in-a-new-city','Kwame Asante','p-man-white-vneck','Abidjan, Côte d’Ivoire',5,'Six clauses to never sign','I was two days from signing a lease with three of them in it.',2,81],
  ['planting-in-a-new-city','Fatou Diallo','p-woman-hijab','Dakar, Senegal',5,'Twelve committed beats eighty curious','Completely reframed how I was measuring the first year.',4,63],
  ['planting-in-a-new-city','Chinedu Obi','p-man-glasses-tee','Lagos, Nigeria',4,'Budget templates assume more income than we have','Excellent course. The eighteen-month budget model needed adapting for our context.',7,34],

  // leading-a-diaspora-congregation
  ['leading-a-diaspora-congregation','Ngozi Okonkwo','p-woman-yellow','Montgomery, USA',5,'Three generations, three cultures, one room','That is my congregation exactly and I had never heard anyone name it so precisely.',2,88],
  ['leading-a-diaspora-congregation','Jae-won Park','p-man-blue-shirt','Atlanta, USA',5,'Why the second generation leaves','Painful and accurate. We have started making the changes.',3,76],
  ['leading-a-diaspora-congregation','Marie Toussaint','p-woman-dark-portrait','Miami, USA',5,'The language policy assignment','We had never made the decision explicitly. Drafting it forced a conversation we had avoided for years.',5,64],

  // cross-cultural-mission-preparation
  ['cross-cultural-mission-preparation','Ellie Ward','p-woman-striped','Birmingham, USA',5,'Re-entry, planned before departure','Everyone told me the going would be hard. Nobody mentioned coming back. A whole section on it.',3,71],
  ['cross-cultural-mission-preparation','Tobias Mwale','p-man-dark-beard','Lilongwe, Malawi',5,'Support raising without treating people as donors','Changed how I write my updates entirely.',2,59],
  ['cross-cultural-mission-preparation','Rosa Alvarez','p-woman-red-top','Montgomery, USA',4,'Visa section is necessarily general','Useful framing, but you will still need country-specific advice. It says so, to be fair.',6,33],
];

export const reviews = R.map(([courseSlug, authorName, avatar, authorLocation, rating, title, body, monthsAgo, helpful]) => ({
  courseSlug,
  authorName,
  authorAvatar: `/media/people/${avatar}@200.webp`,
  authorLocation,
  rating,
  title,
  body,
  monthsAgo,
  helpful,
}));
