# Every sentence, for the five sample people

> **After the fix** (branch `sentence-fix`). Regenerate with `node scripts/dump-sentences.mjs > docs/SENTENCE-DUMP.md`, then put the copy edit back.

Written by `node scripts/dump-sentences.mjs` on 2026-11-18 (fictional people and invented facts only). `{name}` is the blank and `{rel}` the person's relationship. Each answer shows every distinct sentence it gives across the five sample people (June, aunt; Leo, neighbor; Ruth, cousin; Omar, friend; Mae, granddaughter), every variant and every phrasing, in wording 2, which new cards use. Wording 1 is kept byte for byte for cards approved before 2026-11-18 and is not shown.

1348 sentences in all.

## The copy edit

Read line by line on 2026-11-18, on the output before the fix (in git at `be7bdcc`, which also has that whole dump). Every row is fixed in wording 2, and each class is now a check in `scripts/check-sentences.mjs`, planted with the "before" sentence so it is seen to fail while the fixed one passes. The dump below is the output after the fix.

| # | Kind of fact | Answer typed | Sentence before the fix | Problem |
| --- | --- | --- | --- | --- |
| 1 | every kind | (empty) | "My {rel}, {name}, works as." · "Who?" · "{name} and I met." | Dangling bridge word: no card should exist |
| 2 | memory | an early riser | "{name} an early riser." | Missing verb ("is") |
| 3 | memory | grows tomatoes every summer | "I know that this person grows tomatoes every summer. Who is this?" | Awkward: "I know that" over a photo |
| 4 | work | accountants | "{name} works as accountants." · "{name} is accountants." | A plural job for one person |
| 5 | work, pastwork, interest | Nurse at the clinic · Mail carrier · Golf | "works as Nurse at the clinic." · "worked as Mail carrier." · "enjoys Golf." | A typed capital mid-sentence (these fields never auto-capitalize) |
| 6 | plans | to visit Spain | "is planning to to visit Spain." | Repeated word |
| 7 | plans | a trip to Maine | "is planning to a trip to Maine." | Wrong bridge word |
| 8 | team | baseball | "{name}’s favorite team is baseball." · "cheers for baseball." | A sport, not a team |
| 9 | show, place | game shows · beaches | "favorite show is game shows." · "favorite place is beaches." | A kind of thing, not one favorite |
| 10 | place | park | "{name} loves park." · "loves going to park." | Missing article |
| 11 | shared | a picnic | "There was a time when a picnic, with {name} and me." | A thing said as a clause: no verb |
| 12 | regular | the park · camping | "{name} and I always the park." · "{name} and I always camping." | Missing bridge words ("went to", "went") |
| 13 | met | school | "{name} and I met school." · "Who did you meet school?" | Missing preposition ("at") |
| 14 | met | when we were 5 | "Who did you meet when we were 5?" | Person: "you" with "we" |
| 15 | birthday | May | "{name}’s birthday is on May." · "was born on May." | Preposition: a month takes "in" |
| 16 | calls | grandma | "I call {name} grandma." | A name in lower case |
| 17 | known | all our lives | "I have known {name} all our lives." | Person: "I" with "our" |
| 18 | lives_with | alone | "{name} lives with alone." | Wrong bridge word |
| 19 | pet | Rex and Bella | "{name} has Rex and Bella." | Two pets read as one thing |
| 20 | partner | Sam and Alex | "{name}’s partner is Sam and Alex." | Number: two partners as one |

**Wording 1, which most cards still use** (not in the dump below, which shows wording 2): "My aunt, {name}, is nurse." · "enjoys knit." · "has dog." · "always hum in the kitchen." · "and I we went to Paris." · "worked as teacher." · "loves park." Every card approved before 2026-11-18, the sample people, and every card read from a server without the `wording` column use these. That is the main reason cards still read badly: see "Root cause" in the report.

## memory

**(empty)**

- (no sentence, so no card)

**“grows tomatoes every summer”**

- My {rel}, {name}, grows tomatoes every summer.
- {name} grows tomatoes every summer.
- Who grows tomatoes every summer?
- This person grows tomatoes every summer. Who is this?
- Who is this?
- This person grows tomatoes every summer.
- I know that my {rel}, {name}, grows tomatoes every summer.
- I know that {name} grows tomatoes every summer.

**“Loves to bake bread”**

- My {rel}, {name}, loves to bake bread.
- {name} loves to bake bread.
- Who loves to bake bread?
- This person loves to bake bread. Who is this?
- Who is this?
- This person loves to bake bread.
- I know that my {rel}, {name}, loves to bake bread.
- I know that {name} loves to bake bread.

**“She knits scarves”**

- My {rel}, {name}, knits scarves.
- {name} knits scarves.
- Who knits scarves?
- This person knits scarves. Who is this?
- Who is this?
- This person knits scarves.
- I know that my {rel}, {name}, knits scarves.
- I know that {name} knits scarves.

**“They love card games”**

- My {rel}, {name}, loves card games.
- {name} loves card games.
- Who loves card games?
- This person loves card games. Who is this?
- Who is this?
- This person loves card games.
- I know that my {rel}, {name}, loves card games.
- I know that {name} loves card games.

**“an early riser”**

- My {rel}, {name}, is an early riser.
- {name} is an early riser.
- Who is an early riser?
- This person is an early riser. Who is this?
- Who is this?
- This person is an early riser.
- I know that my {rel}, {name}, is an early riser.
- I know that {name} is an early riser.

**“owns three bikes”**

- My {rel}, {name}, owns three bikes.
- {name} owns three bikes.
- Who owns three bikes?
- This person owns three bikes. Who is this?
- Who is this?
- This person owns three bikes.
- I know that my {rel}, {name}, owns three bikes.
- I know that {name} owns three bikes.

## work

**(empty)**

- (no sentence, so no card)

**“nurse”**

- My {rel}, {name}, works as a nurse.
- {name} works as a nurse.
- Who works as a nurse?
- This person works as a nurse. Who is this?
- Who is this?
- This person works as a nurse.
- My {rel}, {name}, is a nurse.
- {name} is a nurse.
- Who is a nurse?
- This person is a nurse. Who is this?
- This person is a nurse.

**“a nurse”**

- My {rel}, {name}, works as a nurse.
- {name} works as a nurse.
- Who works as a nurse?
- This person works as a nurse. Who is this?
- Who is this?
- This person works as a nurse.
- My {rel}, {name}, is a nurse.
- {name} is a nurse.
- Who is a nurse?
- This person is a nurse. Who is this?
- This person is a nurse.

**“engineer”**

- My {rel}, {name}, works as an engineer.
- {name} works as an engineer.
- Who works as an engineer?
- This person works as an engineer. Who is this?
- Who is this?
- This person works as an engineer.
- My {rel}, {name}, is an engineer.
- {name} is an engineer.
- Who is an engineer?
- This person is an engineer. Who is this?
- This person is an engineer.

**“teaches math”**

- My {rel}, {name}, teaches math.
- {name} teaches math.
- Who teaches math?
- This person teaches math. Who is this?
- Who is this?
- This person teaches math.

**“retired”**

- My {rel}, {name}, is retired.
- {name} is retired.
- Who is retired?
- This person is retired. Who is this?
- Who is this?
- This person is retired.

**“accountants”**

- My {rel}, {name}, works as an accountant.
- {name} works as an accountant.
- Who works as an accountant?
- This person works as an accountant. Who is this?
- Who is this?
- This person works as an accountant.
- My {rel}, {name}, is an accountant.
- {name} is an accountant.
- Who is an accountant?
- This person is an accountant. Who is this?
- This person is an accountant.

**“works at the bank”**

- My {rel}, {name}, works at the bank.
- {name} works at the bank.
- Who works at the bank?
- This person works at the bank. Who is this?
- Who is this?
- This person works at the bank.

**“Nurse at the clinic”**

- My {rel}, {name}, works as a nurse at the clinic.
- {name} works as a nurse at the clinic.
- Who works as a nurse at the clinic?
- This person works as a nurse at the clinic. Who is this?
- Who is this?
- This person works as a nurse at the clinic.
- My {rel}, {name}, is a nurse at the clinic.
- {name} is a nurse at the clinic.
- Who is a nurse at the clinic?
- This person is a nurse at the clinic. Who is this?
- This person is a nurse at the clinic.

**“owner of a bakery”**

- My {rel}, {name}, works as an owner of a bakery.
- {name} works as an owner of a bakery.
- Who works as an owner of a bakery?
- This person works as an owner of a bakery. Who is this?
- Who is this?
- This person works as an owner of a bakery.
- My {rel}, {name}, is an owner of a bakery.
- {name} is an owner of a bakery.
- Who is an owner of a bakery?
- This person is an owner of a bakery. Who is this?
- This person is an owner of a bakery.

## pastwork

**(empty)**

- (no sentence, so no card)

**“teacher”**

- My {rel}, {name}, worked as a teacher.
- {name} worked as a teacher.
- Who worked as a teacher?
- This person worked as a teacher. Who is this?
- Who is this?
- This person worked as a teacher.
- My {rel}, {name}, used to work as a teacher.
- {name} used to work as a teacher.
- Who used to work as a teacher?
- This person used to work as a teacher. Who is this?
- This person used to work as a teacher.

**“an engineer”**

- My {rel}, {name}, worked as an engineer.
- {name} worked as an engineer.
- Who worked as an engineer?
- This person worked as an engineer. Who is this?
- Who is this?
- This person worked as an engineer.
- My {rel}, {name}, used to work as an engineer.
- {name} used to work as an engineer.
- Who used to work as an engineer?
- This person used to work as an engineer. Who is this?
- This person used to work as an engineer.

**“taught school”**

- My {rel}, {name}, taught school.
- {name} taught school.
- Who taught school?
- This person taught school. Who is this?
- Who is this?
- This person taught school.

**“worked at the mill”**

- My {rel}, {name}, worked at the mill.
- {name} worked at the mill.
- Who worked at the mill?
- This person worked at the mill. Who is this?
- Who is this?
- This person worked at the mill.

**“farmer and carpenter”**

- My {rel}, {name}, worked as a farmer and carpenter.
- {name} worked as a farmer and carpenter.
- Who worked as a farmer and carpenter?
- This person worked as a farmer and carpenter. Who is this?
- Who is this?
- This person worked as a farmer and carpenter.
- My {rel}, {name}, used to work as a farmer and carpenter.
- {name} used to work as a farmer and carpenter.
- Who used to work as a farmer and carpenter?
- This person used to work as a farmer and carpenter. Who is this?
- This person used to work as a farmer and carpenter.

**“Mail carrier”**

- My {rel}, {name}, worked as a mail carrier.
- {name} worked as a mail carrier.
- Who worked as a mail carrier?
- This person worked as a mail carrier. Who is this?
- Who is this?
- This person worked as a mail carrier.
- My {rel}, {name}, used to work as a mail carrier.
- {name} used to work as a mail carrier.
- Who used to work as a mail carrier?
- This person used to work as a mail carrier. Who is this?
- This person used to work as a mail carrier.

## field

**(empty)**

- (no sentence, so no card)

**“health care”**

- My {rel}, {name}, has worked in health care.
- {name} has worked in health care.
- Who has worked in health care?
- This person has worked in health care. Who is this?
- Who is this?
- This person has worked in health care.
- My {rel}, {name}, has had a career in health care.
- {name} has had a career in health care.
- Who has had a career in health care?
- This person has had a career in health care. Who is this?
- This person has had a career in health care.

**“education”**

- My {rel}, {name}, has worked in education.
- {name} has worked in education.
- Who has worked in education?
- This person has worked in education. Who is this?
- Who is this?
- This person has worked in education.
- My {rel}, {name}, has had a career in education.
- {name} has had a career in education.
- Who has had a career in education?
- This person has had a career in education. Who is this?
- This person has had a career in education.

**“the trades”**

- My {rel}, {name}, has worked in the trades.
- {name} has worked in the trades.
- Who has worked in the trades?
- This person has worked in the trades. Who is this?
- Who is this?
- This person has worked in the trades.
- My {rel}, {name}, has had a career in the trades.
- {name} has had a career in the trades.
- Who has had a career in the trades?
- This person has had a career in the trades. Who is this?
- This person has had a career in the trades.

**“farming”**

- My {rel}, {name}, has worked in farming.
- {name} has worked in farming.
- Who has worked in farming?
- This person has worked in farming. Who is this?
- Who is this?
- This person has worked in farming.
- My {rel}, {name}, has had a career in farming.
- {name} has had a career in farming.
- Who has had a career in farming?
- This person has had a career in farming. Who is this?
- This person has had a career in farming.

## workplace

**(empty)**

- (no sentence, so no card)

**“the library”**

- My {rel}, {name}, has worked or studied at the library.
- {name} has worked or studied at the library.
- Who has worked or studied at the library?
- This person has worked or studied at the library. Who is this?
- Who is this?
- This person has worked or studied at the library.
- My {rel}, {name}, spent time working or studying at the library.
- {name} spent time working or studying at the library.
- This person spent time working or studying at the library. Who is this?
- This person spent time working or studying at the library.

**“Mercy Hospital”**

- My {rel}, {name}, has worked or studied at Mercy Hospital.
- {name} has worked or studied at Mercy Hospital.
- Who has worked or studied at Mercy Hospital?
- This person has worked or studied at Mercy Hospital. Who is this?
- Who is this?
- This person has worked or studied at Mercy Hospital.
- My {rel}, {name}, spent time working or studying at Mercy Hospital.
- {name} spent time working or studying at Mercy Hospital.
- This person spent time working or studying at Mercy Hospital. Who is this?
- This person spent time working or studying at Mercy Hospital.

**“a bakery”**

- My {rel}, {name}, has worked or studied at a bakery.
- {name} has worked or studied at a bakery.
- Who has worked or studied at a bakery?
- This person has worked or studied at a bakery. Who is this?
- Who is this?
- This person has worked or studied at a bakery.
- My {rel}, {name}, spent time working or studying at a bakery.
- {name} spent time working or studying at a bakery.
- This person spent time working or studying at a bakery. Who is this?
- This person spent time working or studying at a bakery.

**“the post office and the bank”**

- My {rel}, {name}, has worked or studied at the post office and the bank.
- {name} has worked or studied at the post office and the bank.
- Who has worked or studied at the post office and the bank?
- This person has worked or studied at the post office and the bank. Who is this?
- Who is this?
- This person has worked or studied at the post office and the bank.
- My {rel}, {name}, spent time working or studying at the post office and the bank.
- {name} spent time working or studying at the post office and the bank.
- This person spent time working or studying at the post office and the bank. Who is this?
- This person spent time working or studying at the post office and the bank.

## plans

**(empty)**

- (no sentence, so no card)

**“retire next year”**

- My {rel}, {name}, is planning to retire next year.
- {name} is planning to retire next year.
- Who is planning to retire next year?
- This person is planning to retire next year. Who is this?
- Who is this?
- This person is planning to retire next year.
- My {rel}, {name}, plans to retire next year.
- {name} plans to retire next year.
- Who plans to retire next year?
- This person plans to retire next year. Who is this?
- This person plans to retire next year.

**“moving to Florida”**

- My {rel}, {name}, is moving to Florida.
- {name} is moving to Florida.
- Who is moving to Florida?
- This person is moving to Florida. Who is this?
- Who is this?
- This person is moving to Florida.

**“travel”**

- My {rel}, {name}, is planning to travel.
- {name} is planning to travel.
- Who is planning to travel?
- This person is planning to travel. Who is this?
- Who is this?
- This person is planning to travel.
- My {rel}, {name}, plans to travel.
- {name} plans to travel.
- Who plans to travel?
- This person plans to travel. Who is this?
- This person plans to travel.

**“to visit Spain”**

- My {rel}, {name}, is planning to visit Spain.
- {name} is planning to visit Spain.
- Who is planning to visit Spain?
- This person is planning to visit Spain. Who is this?
- Who is this?
- This person is planning to visit Spain.
- My {rel}, {name}, plans to visit Spain.
- {name} plans to visit Spain.
- Who plans to visit Spain?
- This person plans to visit Spain. Who is this?
- This person plans to visit Spain.

**“a trip to Maine”**

- My {rel}, {name}, is planning a trip to Maine.
- {name} is planning a trip to Maine.
- Who is planning a trip to Maine?
- This person is planning a trip to Maine. Who is this?
- Who is this?
- This person is planning a trip to Maine.

## interest

**(empty)**

- (no sentence, so no card)

**“gardening”**

- My {rel}, {name}, enjoys gardening.
- {name} enjoys gardening.
- Who enjoys gardening?
- This person enjoys gardening. Who is this?
- Who is this?
- This person enjoys gardening.
- My {rel}, {name}, likes gardening.
- {name} likes gardening.
- Who likes gardening?
- This person likes gardening. Who is this?
- This person likes gardening.

**“card games”**

- My {rel}, {name}, enjoys card games.
- {name} enjoys card games.
- Who enjoys card games?
- This person enjoys card games. Who is this?
- Who is this?
- This person enjoys card games.
- My {rel}, {name}, likes card games.
- {name} likes card games.
- Who likes card games?
- This person likes card games. Who is this?
- This person likes card games.

**“knit”**

- My {rel}, {name}, enjoys knitting.
- {name} enjoys knitting.
- Who enjoys knitting?
- This person enjoys knitting. Who is this?
- Who is this?
- This person enjoys knitting.
- My {rel}, {name}, likes knitting.
- {name} likes knitting.
- Who likes knitting?
- This person likes knitting. Who is this?
- This person likes knitting.

**“to paint”**

- My {rel}, {name}, enjoys painting.
- {name} enjoys painting.
- Who enjoys painting?
- This person enjoys painting. Who is this?
- Who is this?
- This person enjoys painting.
- My {rel}, {name}, likes painting.
- {name} likes painting.
- Who likes painting?
- This person likes painting. Who is this?
- This person likes painting.

**“puzzles and crosswords”**

- My {rel}, {name}, enjoys puzzles and crosswords.
- {name} enjoys puzzles and crosswords.
- Who enjoys puzzles and crosswords?
- This person enjoys puzzles and crosswords. Who is this?
- Who is this?
- This person enjoys puzzles and crosswords.
- My {rel}, {name}, likes puzzles and crosswords.
- {name} likes puzzles and crosswords.
- Who likes puzzles and crosswords?
- This person likes puzzles and crosswords. Who is this?
- This person likes puzzles and crosswords.

**“Golf”**

- My {rel}, {name}, enjoys golfing.
- {name} enjoys golfing.
- Who enjoys golfing?
- This person enjoys golfing. Who is this?
- Who is this?
- This person enjoys golfing.
- My {rel}, {name}, likes golfing.
- {name} likes golfing.
- Who likes golfing?
- This person likes golfing. Who is this?
- This person likes golfing.

**“the garden”**

- My {rel}, {name}, enjoys the garden.
- {name} enjoys the garden.
- Who enjoys the garden?
- This person enjoys the garden. Who is this?
- Who is this?
- This person enjoys the garden.
- My {rel}, {name}, likes the garden.
- {name} likes the garden.
- Who likes the garden?
- This person likes the garden. Who is this?
- This person likes the garden.

**“birds”**

- My {rel}, {name}, enjoys birds.
- {name} enjoys birds.
- Who enjoys birds?
- This person enjoys birds. Who is this?
- Who is this?
- This person enjoys birds.
- My {rel}, {name}, likes birds.
- {name} likes birds.
- Who likes birds?
- This person likes birds. Who is this?
- This person likes birds.

## team

**(empty)**

- (no sentence, so no card)

**“the Otters”**

- My {rel}, {name}, is a fan of the Otters.
- {name} is a fan of the Otters.
- {name}’s favorite team is the Otters.
- Who is a fan of the Otters?
- This person is a fan of the Otters. Who is this?
- Who is this?
- This person is a fan of the Otters.
- My {rel}, {name}, loves the Otters.
- {name} loves the Otters.
- Who loves the Otters?
- This person loves the Otters. Who is this?
- This person loves the Otters.
- My {rel}, {name}, cheers for the Otters.
- {name} cheers for the Otters.
- Who cheers for the Otters?
- This person cheers for the Otters. Who is this?
- This person cheers for the Otters.

**“Otters”**

- My {rel}, {name}, is a fan of the Otters.
- {name} is a fan of the Otters.
- {name}’s favorite team is the Otters.
- Who is a fan of the Otters?
- This person is a fan of the Otters. Who is this?
- Who is this?
- This person is a fan of the Otters.
- My {rel}, {name}, loves the Otters.
- {name} loves the Otters.
- Who loves the Otters?
- This person loves the Otters. Who is this?
- This person loves the Otters.
- My {rel}, {name}, cheers for the Otters.
- {name} cheers for the Otters.
- Who cheers for the Otters?
- This person cheers for the Otters. Who is this?
- This person cheers for the Otters.

**“baseball”**

- My {rel}, {name}, loves baseball.
- {name} loves baseball.
- Who loves baseball?
- This person loves baseball. Who is this?
- Who is this?
- This person loves baseball.
- My {rel}, {name}, is a fan of baseball.
- {name} is a fan of baseball.
- Who is a fan of baseball?
- This person is a fan of baseball. Who is this?
- This person is a fan of baseball.

**“the Riverton Otters and the Bears”**

- My {rel}, {name}, is a fan of the Riverton Otters and the Bears.
- {name} is a fan of the Riverton Otters and the Bears.
- {name}’s favorite team is the Riverton Otters and the Bears.
- Who is a fan of the Riverton Otters and the Bears?
- This person is a fan of the Riverton Otters and the Bears. Who is this?
- Who is this?
- This person is a fan of the Riverton Otters and the Bears.
- My {rel}, {name}, loves the Riverton Otters and the Bears.
- {name} loves the Riverton Otters and the Bears.
- Who loves the Riverton Otters and the Bears?
- This person loves the Riverton Otters and the Bears. Who is this?
- This person loves the Riverton Otters and the Bears.
- My {rel}, {name}, cheers for the Riverton Otters and the Bears.
- {name} cheers for the Riverton Otters and the Bears.
- Who cheers for the Riverton Otters and the Bears?
- This person cheers for the Riverton Otters and the Bears. Who is this?
- This person cheers for the Riverton Otters and the Bears.

## show

**(empty)**

- (no sentence, so no card)

**“Jeopardy”**

- My {rel}, {name}, loves watching Jeopardy.
- {name} loves watching Jeopardy.
- {name}’s favorite show is Jeopardy.
- Who loves watching Jeopardy?
- This person loves watching Jeopardy. Who is this?
- Who is this?
- This person loves watching Jeopardy.
- My {rel}, {name}, likes to watch Jeopardy.
- {name} likes to watch Jeopardy.
- Who likes to watch Jeopardy?
- This person likes to watch Jeopardy. Who is this?
- This person likes to watch Jeopardy.

**“game shows”**

- My {rel}, {name}, loves watching game shows.
- {name} loves watching game shows.
- Who loves watching game shows?
- This person loves watching game shows. Who is this?
- Who is this?
- This person loves watching game shows.
- My {rel}, {name}, likes to watch game shows.
- {name} likes to watch game shows.
- Who likes to watch game shows?
- This person likes to watch game shows. Who is this?
- This person likes to watch game shows.

**“the news”**

- My {rel}, {name}, loves watching the news.
- {name} loves watching the news.
- Who loves watching the news?
- This person loves watching the news. Who is this?
- Who is this?
- This person loves watching the news.
- My {rel}, {name}, likes to watch the news.
- {name} likes to watch the news.
- Who likes to watch the news?
- This person likes to watch the news. Who is this?
- This person likes to watch the news.

**“cooking shows”**

- My {rel}, {name}, loves watching cooking shows.
- {name} loves watching cooking shows.
- Who loves watching cooking shows?
- This person loves watching cooking shows. Who is this?
- Who is this?
- This person loves watching cooking shows.
- My {rel}, {name}, likes to watch cooking shows.
- {name} likes to watch cooking shows.
- Who likes to watch cooking shows?
- This person likes to watch cooking shows. Who is this?
- This person likes to watch cooking shows.

## movie

**(empty)**

- (no sentence, so no card)

**“Casablanca”**

- My {rel}, {name}, loves the movie Casablanca.
- {name} loves the movie Casablanca.
- {name}’s favorite movie is Casablanca.
- Who loves the movie Casablanca?
- This person loves the movie Casablanca. Who is this?
- Who is this?
- This person loves the movie Casablanca.
- My {rel}, {name}, is a fan of the movie Casablanca.
- {name} is a fan of the movie Casablanca.
- Who is a fan of the movie Casablanca?
- This person is a fan of the movie Casablanca. Who is this?
- This person is a fan of the movie Casablanca.

**“The Wizard of Oz”**

- My {rel}, {name}, loves the movie The Wizard of Oz.
- {name} loves the movie The Wizard of Oz.
- {name}’s favorite movie is The Wizard of Oz.
- Who loves the movie The Wizard of Oz?
- This person loves the movie The Wizard of Oz. Who is this?
- Who is this?
- This person loves the movie The Wizard of Oz.
- My {rel}, {name}, is a fan of the movie The Wizard of Oz.
- {name} is a fan of the movie The Wizard of Oz.
- Who is a fan of the movie The Wizard of Oz?
- This person is a fan of the movie The Wizard of Oz. Who is this?
- This person is a fan of the movie The Wizard of Oz.

**“old westerns”**

- My {rel}, {name}, loves old westerns.
- {name} loves old westerns.
- Who loves old westerns?
- This person loves old westerns. Who is this?
- Who is this?
- This person loves old westerns.
- My {rel}, {name}, loves watching old westerns.
- {name} loves watching old westerns.
- Who loves watching old westerns?
- This person loves watching old westerns. Who is this?
- This person loves watching old westerns.

**“comedies”**

- My {rel}, {name}, loves comedies.
- {name} loves comedies.
- Who loves comedies?
- This person loves comedies. Who is this?
- Who is this?
- This person loves comedies.
- My {rel}, {name}, loves watching comedies.
- {name} loves watching comedies.
- Who loves watching comedies?
- This person loves watching comedies. Who is this?
- This person loves watching comedies.

## food

**(empty)**

- (no sentence, so no card)

**“lasagna”**

- My {rel}, {name}, loves lasagna.
- {name} loves lasagna.
- {name}’s favorite food is lasagna.
- Who loves lasagna?
- This person loves lasagna. Who is this?
- Who is this?
- This person loves lasagna.
- My {rel}, {name}, loves to eat lasagna.
- {name} loves to eat lasagna.
- Who loves to eat lasagna?
- This person loves to eat lasagna. Who is this?
- This person loves to eat lasagna.

**“tacos”**

- My {rel}, {name}, loves tacos.
- {name} loves tacos.
- {name}’s favorite food is tacos.
- Who loves tacos?
- This person loves tacos. Who is this?
- Who is this?
- This person loves tacos.
- My {rel}, {name}, loves to eat tacos.
- {name} loves to eat tacos.
- Who loves to eat tacos?
- This person loves to eat tacos. Who is this?
- This person loves to eat tacos.

**“apple pie”**

- My {rel}, {name}, loves apple pie.
- {name} loves apple pie.
- {name}’s favorite food is apple pie.
- Who loves apple pie?
- This person loves apple pie. Who is this?
- Who is this?
- This person loves apple pie.
- My {rel}, {name}, loves to eat apple pie.
- {name} loves to eat apple pie.
- Who loves to eat apple pie?
- This person loves to eat apple pie. Who is this?
- This person loves to eat apple pie.

**“pie”**

- My {rel}, {name}, loves pie.
- {name} loves pie.
- {name}’s favorite food is pie.
- Who loves pie?
- This person loves pie. Who is this?
- Who is this?
- This person loves pie.
- My {rel}, {name}, loves to eat pie.
- {name} loves to eat pie.
- Who loves to eat pie?
- This person loves to eat pie. Who is this?
- This person loves to eat pie.

**“soup and bread”**

- My {rel}, {name}, loves soup and bread.
- {name} loves soup and bread.
- {name}’s favorite food is soup and bread.
- Who loves soup and bread?
- This person loves soup and bread. Who is this?
- Who is this?
- This person loves soup and bread.
- My {rel}, {name}, loves to eat soup and bread.
- {name} loves to eat soup and bread.
- Who loves to eat soup and bread?
- This person loves to eat soup and bread. Who is this?
- This person loves to eat soup and bread.

## music

**(empty)**

- (no sentence, so no card)

**“jazz”**

- My {rel}, {name}, loves listening to jazz.
- {name} loves listening to jazz.
- {name}’s favorite music is jazz.
- Who loves listening to jazz?
- This person loves listening to jazz. Who is this?
- Who is this?
- This person loves listening to jazz.
- My {rel}, {name}, enjoys listening to jazz.
- {name} enjoys listening to jazz.
- Who enjoys listening to jazz?
- This person enjoys listening to jazz. Who is this?
- This person enjoys listening to jazz.

**“the Beatles”**

- My {rel}, {name}, loves listening to the Beatles.
- {name} loves listening to the Beatles.
- {name}’s favorite music is the Beatles.
- Who loves listening to the Beatles?
- This person loves listening to the Beatles. Who is this?
- Who is this?
- This person loves listening to the Beatles.
- My {rel}, {name}, enjoys listening to the Beatles.
- {name} enjoys listening to the Beatles.
- Who enjoys listening to the Beatles?
- This person enjoys listening to the Beatles. Who is this?
- This person enjoys listening to the Beatles.

**“Elvis”**

- My {rel}, {name}, loves listening to Elvis.
- {name} loves listening to Elvis.
- {name}’s favorite music is Elvis.
- Who loves listening to Elvis?
- This person loves listening to Elvis. Who is this?
- Who is this?
- This person loves listening to Elvis.
- My {rel}, {name}, enjoys listening to Elvis.
- {name} enjoys listening to Elvis.
- Who enjoys listening to Elvis?
- This person enjoys listening to Elvis. Who is this?
- This person enjoys listening to Elvis.

**“old hymns”**

- My {rel}, {name}, loves listening to old hymns.
- {name} loves listening to old hymns.
- {name}’s favorite music is old hymns.
- Who loves listening to old hymns?
- This person loves listening to old hymns. Who is this?
- Who is this?
- This person loves listening to old hymns.
- My {rel}, {name}, enjoys listening to old hymns.
- {name} enjoys listening to old hymns.
- Who enjoys listening to old hymns?
- This person enjoys listening to old hymns. Who is this?
- This person enjoys listening to old hymns.

## place

**(empty)**

- (no sentence, so no card)

**“the lake”**

- My {rel}, {name}, loves the lake.
- {name} loves the lake.
- {name}’s favorite place is the lake.
- Who loves the lake?
- This person loves the lake. Who is this?
- Who is this?
- This person loves the lake.
- My {rel}, {name}, loves going to the lake.
- {name} loves going to the lake.
- Who loves going to the lake?
- This person loves going to the lake. Who is this?
- This person loves going to the lake.

**“Paris”**

- My {rel}, {name}, loves Paris.
- {name} loves Paris.
- {name}’s favorite place is Paris.
- Who loves Paris?
- This person loves Paris. Who is this?
- Who is this?
- This person loves Paris.
- My {rel}, {name}, loves going to Paris.
- {name} loves going to Paris.
- Who loves going to Paris?
- This person loves going to Paris. Who is this?
- This person loves going to Paris.

**“beaches”**

- My {rel}, {name}, loves beaches.
- {name} loves beaches.
- Who loves beaches?
- This person loves beaches. Who is this?
- Who is this?
- This person loves beaches.
- My {rel}, {name}, loves going to beaches.
- {name} loves going to beaches.
- Who loves going to beaches?
- This person loves going to beaches. Who is this?
- This person loves going to beaches.

**“going to the beach”**

- My {rel}, {name}, loves going to the beach.
- {name} loves going to the beach.
- Who loves going to the beach?
- This person loves going to the beach. Who is this?
- Who is this?
- This person loves going to the beach.
- My {rel}, {name}, enjoys going to the beach.
- {name} enjoys going to the beach.
- Who enjoys going to the beach?
- This person enjoys going to the beach. Who is this?
- This person enjoys going to the beach.

**“park”**

- My {rel}, {name}, loves the park.
- {name} loves the park.
- {name}’s favorite place is the park.
- Who loves the park?
- This person loves the park. Who is this?
- Who is this?
- This person loves the park.
- My {rel}, {name}, loves going to the park.
- {name} loves going to the park.
- Who loves going to the park?
- This person loves going to the park. Who is this?
- This person loves going to the park.

**“the mountains”**

- My {rel}, {name}, loves the mountains.
- {name} loves the mountains.
- Who loves the mountains?
- This person loves the mountains. Who is this?
- Who is this?
- This person loves the mountains.
- My {rel}, {name}, loves going to the mountains.
- {name} loves going to the mountains.
- Who loves going to the mountains?
- This person loves going to the mountains. Who is this?
- This person loves going to the mountains.

## habit

**(empty)**

- (no sentence, so no card)

**“hums in the kitchen”**

- My {rel}, {name}, always hums in the kitchen.
- {name} always hums in the kitchen.
- Who always hums in the kitchen?
- This person always hums in the kitchen. Who is this?
- Who is this?
- This person always hums in the kitchen.

**“hum”**

- My {rel}, {name}, always hums.
- {name} always hums.
- Who always hums?
- This person always hums. Who is this?
- Who is this?
- This person always hums.

**“late”**

- My {rel}, {name}, is always late.
- {name} is always late.
- Who is always late?
- This person is always late. Who is this?
- Who is this?
- This person is always late.

**“They always say hello”**

- My {rel}, {name}, always says hello.
- {name} always says hello.
- Who always says hello?
- This person always says hello. Who is this?
- Who is this?
- This person always says hello.

**“whistles”**

- My {rel}, {name}, always whistles.
- {name} always whistles.
- Who always whistles?
- This person always whistles. Who is this?
- Who is this?
- This person always whistles.

**“makes pancakes on Sundays”**

- My {rel}, {name}, always makes pancakes on Sundays.
- {name} always makes pancakes on Sundays.
- Who always makes pancakes on Sundays?
- This person always makes pancakes on Sundays. Who is this?
- Who is this?
- This person always makes pancakes on Sundays.

**“early”**

- My {rel}, {name}, is always early.
- {name} is always early.
- Who is always early?
- This person is always early. Who is this?
- Who is this?
- This person is always early.

## shared

**(empty)**

- (no sentence, so no card)

**“got lost in Rome”**

- I remember when my {rel}, {name}, and I got lost in Rome.
- I remember when {name} and I got lost in Rome.
- I remember when this person and I got lost in Rome. Who is this?
- Who is this?
- I remember when this person and I got lost in Rome.
- There was a time when my {rel}, {name}, and I got lost in Rome.
- There was a time when {name} and I got lost in Rome.
- There was a time when this person and I got lost in Rome. Who is this?
- There was a time when this person and I got lost in Rome.
- My {rel}, {name}, and I once got lost in Rome.
- {name} and I once got lost in Rome.
- This person and I once got lost in Rome. Who is this?
- This person and I once got lost in Rome.

**“we went to Paris”**

- I remember when my {rel}, {name}, and I went to Paris.
- I remember when {name} and I went to Paris.
- I remember when this person and I went to Paris. Who is this?
- Who is this?
- I remember when this person and I went to Paris.
- There was a time when my {rel}, {name}, and I went to Paris.
- There was a time when {name} and I went to Paris.
- There was a time when this person and I went to Paris. Who is this?
- There was a time when this person and I went to Paris.
- My {rel}, {name}, and I once went to Paris.
- {name} and I once went to Paris.
- This person and I once went to Paris. Who is this?
- This person and I once went to Paris.

**“The time we baked a cake”**

- I remember when my {rel}, {name}, and I baked a cake.
- I remember when {name} and I baked a cake.
- I remember when this person and I baked a cake. Who is this?
- Who is this?
- I remember when this person and I baked a cake.
- There was a time when my {rel}, {name}, and I baked a cake.
- There was a time when {name} and I baked a cake.
- There was a time when this person and I baked a cake. Who is this?
- There was a time when this person and I baked a cake.
- My {rel}, {name}, and I once baked a cake.
- {name} and I once baked a cake.
- This person and I once baked a cake. Who is this?
- This person and I once baked a cake.

**“went fishing”**

- I remember when my {rel}, {name}, and I went fishing.
- I remember when {name} and I went fishing.
- I remember when this person and I went fishing. Who is this?
- Who is this?
- I remember when this person and I went fishing.
- There was a time when my {rel}, {name}, and I went fishing.
- There was a time when {name} and I went fishing.
- There was a time when this person and I went fishing. Who is this?
- There was a time when this person and I went fishing.
- My {rel}, {name}, and I once went fishing.
- {name} and I once went fishing.
- This person and I once went fishing. Who is this?
- This person and I once went fishing.

**“a picnic”**

- I remember a picnic with my {rel}, {name}.
- I remember a picnic with {name}.
- I remember a picnic with this person. Who is this?
- Who is this?
- I remember a picnic with this person.

**“our car broke down”**

- There was a time when our car broke down, with my {rel}, {name}, and me.
- There was a time when our car broke down, with {name} and me.
- There was a time when our car broke down, with this person and me. Who is this?
- Who is this?
- There was a time when our car broke down, with this person and me.

## regular

**(empty)**

- (no sentence, so no card)

**“went for ice cream”**

- My {rel}, {name}, and I always went for ice cream.
- {name} and I always went for ice cream.
- This person and I always went for ice cream. Who is this?
- Who is this?
- This person and I always went for ice cream.

**“go to the diner”**

- My {rel}, {name}, and I always go to the diner.
- {name} and I always go to the diner.
- This person and I always go to the diner. Who is this?
- Who is this?
- This person and I always go to the diner.

**“We went to the movies”**

- My {rel}, {name}, and I always went to the movies.
- {name} and I always went to the movies.
- This person and I always went to the movies. Who is this?
- Who is this?
- This person and I always went to the movies.

**“the park”**

- My {rel}, {name}, and I always went to the park.
- {name} and I always went to the park.
- This person and I always went to the park. Who is this?
- Who is this?
- This person and I always went to the park.

**“camping”**

- My {rel}, {name}, and I always went camping.
- {name} and I always went camping.
- This person and I always went camping. Who is this?
- Who is this?
- This person and I always went camping.

## holiday

**(empty)**

- (no sentence, so no card)

**“at the lake”**

- My {rel}, {name}, and I spent a holiday at the lake.
- {name} and I spent a holiday at the lake.
- This person and I spent a holiday at the lake. Who is this?
- Who is this?
- This person and I spent a holiday at the lake.
- On one holiday, my {rel}, {name}, and I were at the lake.
- On one holiday, {name} and I were at the lake.
- On one holiday, this person and I were at the lake. Who is this?
- On one holiday, this person and I were at the lake.

**“went to Florida”**

- My {rel}, {name}, and I went to Florida on a holiday.
- {name} and I went to Florida on a holiday.
- This person and I went to Florida on a holiday. Who is this?
- Who is this?
- This person and I went to Florida on a holiday.
- On one holiday, my {rel}, {name}, and I went to Florida.
- On one holiday, {name} and I went to Florida.
- On one holiday, this person and I went to Florida. Who is this?
- On one holiday, this person and I went to Florida.

**“Christmas at the farm”**

- My {rel}, {name}, and I spent Christmas at the farm together.
- {name} and I spent Christmas at the farm together.
- This person and I spent Christmas at the farm together. Who is this?
- Who is this?
- This person and I spent Christmas at the farm together.

**“spent a week in Maine”**

- My {rel}, {name}, and I spent a week in Maine on a holiday.
- {name} and I spent a week in Maine on a holiday.
- This person and I spent a week in Maine on a holiday. Who is this?
- Who is this?
- This person and I spent a week in Maine on a holiday.
- On one holiday, my {rel}, {name}, and I spent a week in Maine.
- On one holiday, {name} and I spent a week in Maine.
- On one holiday, this person and I spent a week in Maine. Who is this?
- On one holiday, this person and I spent a week in Maine.

**“Thanksgiving”**

- My {rel}, {name}, and I spent Thanksgiving together.
- {name} and I spent Thanksgiving together.
- This person and I spent Thanksgiving together. Who is this?
- Who is this?
- This person and I spent Thanksgiving together.

## met

**(empty)**

- (no sentence, so no card)

**“at church”**

- My {rel}, {name}, and I met at church.
- {name} and I met at church.
- Who did you meet at church?
- This person and I met at church. Who is this?
- Who is this?
- This person and I met at church.
- I met my {rel}, {name}, at church.
- I met {name} at church.
- I met this person at church. Who is this?
- I met this person at church.

**“in college”**

- My {rel}, {name}, and I met in college.
- {name} and I met in college.
- Who did you meet in college?
- This person and I met in college. Who is this?
- Who is this?
- This person and I met in college.
- I met my {rel}, {name}, in college.
- I met {name} in college.
- I met this person in college. Who is this?
- I met this person in college.

**“We met at work”**

- My {rel}, {name}, and I met at work.
- {name} and I met at work.
- Who did you meet at work?
- This person and I met at work. Who is this?
- Who is this?
- This person and I met at work.
- I met my {rel}, {name}, at work.
- I met {name} at work.
- I met this person at work. Who is this?
- I met this person at work.

**“when we were 5”**

- My {rel}, {name}, and I met when we were 5.
- {name} and I met when we were 5.
- This person and I met when we were 5. Who is this?
- Who is this?
- This person and I met when we were 5.
- I met my {rel}, {name}, when we were 5.
- I met {name} when we were 5.
- I met this person when we were 5. Who is this?
- I met this person when we were 5.

**“school”**

- My {rel}, {name}, and I met at school.
- {name} and I met at school.
- Who did you meet at school?
- This person and I met at school. Who is this?
- Who is this?
- This person and I met at school.
- I met my {rel}, {name}, at school.
- I met {name} at school.
- I met this person at school. Who is this?
- I met this person at school.

## birthday

**(empty)**

- (no sentence, so no card)

**“March 3”**

- My {rel} {name}’s birthday is on March 3.
- {name}’s birthday is on March 3.
- Whose birthday is on March 3?
- This person’s birthday is on March 3. Who is this?
- Who is this?
- This person’s birthday is on March 3.
- My {rel}, {name}, was born on March 3.
- This person was born on March 3. Who is this?
- This person was born on March 3.

**“in May”**

- My {rel} {name}’s birthday is in May.
- {name}’s birthday is in May.
- Whose birthday is in May?
- This person’s birthday is in May. Who is this?
- Who is this?
- This person’s birthday is in May.
- My {rel}, {name}, was born in May.
- This person was born in May. Who is this?
- This person was born in May.

**“the 4th of July”**

- My {rel} {name}’s birthday is on the 4th of July.
- {name}’s birthday is on the 4th of July.
- Whose birthday is on the 4th of July?
- This person’s birthday is on the 4th of July. Who is this?
- Who is this?
- This person’s birthday is on the 4th of July.
- My {rel}, {name}, was born on the 4th of July.
- This person was born on the 4th of July. Who is this?
- This person was born on the 4th of July.

**“May”**

- My {rel} {name}’s birthday is in May.
- {name}’s birthday is in May.
- Whose birthday is in May?
- This person’s birthday is in May. Who is this?
- Who is this?
- This person’s birthday is in May.
- My {rel}, {name}, was born in May.
- This person was born in May. Who is this?
- This person was born in May.

## nickname

**(empty)**

- (no sentence, so no card)

**“Junie”**

- My {rel}, {name}, goes by Junie.
- {name} goes by Junie.
- Who goes by Junie?
- This person goes by Junie. Who is this?
- Who is this?
- This person goes by Junie.
- My {rel}, {name}, is also called Junie.
- {name} is also called Junie.
- Who is also called Junie?
- This person is also called Junie. Who is this?
- This person is also called Junie.

**“"Bud"”**

- My {rel}, {name}, goes by "Bud."
- {name} goes by "Bud."
- Who goes by "Bud"?
- This person goes by "Bud." Who is this?
- Who is this?
- This person goes by "Bud."
- My {rel}, {name}, is also called "Bud."
- {name} is also called "Bud."
- Who is also called "Bud"?
- This person is also called "Bud." Who is this?
- This person is also called "Bud."

**“J.J.”**

- My {rel}, {name}, goes by J.J.
- {name} goes by J.J.
- Who goes by J.J.?
- This person goes by J.J. Who is this?
- Who is this?
- This person goes by J.J.
- My {rel}, {name}, is also called J.J.
- {name} is also called J.J.
- Who is also called J.J.?
- This person is also called J.J. Who is this?
- This person is also called J.J.

**“Doc”**

- My {rel}, {name}, goes by Doc.
- {name} goes by Doc.
- Who goes by Doc?
- This person goes by Doc. Who is this?
- Who is this?
- This person goes by Doc.
- My {rel}, {name}, is also called Doc.
- {name} is also called Doc.
- Who is also called Doc?
- This person is also called Doc. Who is this?
- This person is also called Doc.

## calls

**(empty)**

- (no sentence, so no card)

**“Nana”**

- I call my {rel}, {name}, Nana.
- I call {name} Nana.
- Who do you call Nana?
- You call this person Nana. Who is this?
- Who is this?
- You call this person Nana.
- My name for my {rel}, {name}, is Nana.
- My name for {name} is Nana.

**“grandma”**

- I call my {rel}, {name}, Grandma.
- I call {name} Grandma.
- Who do you call Grandma?
- You call this person Grandma. Who is this?
- Who is this?
- You call this person Grandma.
- My name for my {rel}, {name}, is Grandma.
- My name for {name} is Grandma.

**“Aunt Bea”**

- I call my {rel}, {name}, Aunt Bea.
- I call {name} Aunt Bea.
- Who do you call Aunt Bea?
- You call this person Aunt Bea. Who is this?
- Who is this?
- You call this person Aunt Bea.
- My name for my {rel}, {name}, is Aunt Bea.
- My name for {name} is Aunt Bea.

## known

**(empty)**

- (no sentence, so no card)

**“since 1962”**

- My {rel}, {name}, and I have known each other since 1962.
- {name} and I have known each other since 1962.
- This person and I have known each other since 1962. Who is this?
- Who is this?
- This person and I have known each other since 1962.
- I have known my {rel}, {name}, since 1962.
- I have known {name} since 1962.
- I have known this person since 1962. Who is this?
- I have known this person since 1962.

**“50 years”**

- My {rel}, {name}, and I have known each other for 50 years.
- {name} and I have known each other for 50 years.
- This person and I have known each other for 50 years. Who is this?
- Who is this?
- This person and I have known each other for 50 years.
- I have known my {rel}, {name}, for 50 years.
- I have known {name} for 50 years.
- I have known this person for 50 years. Who is this?
- I have known this person for 50 years.

**“all our lives”**

- My {rel}, {name}, and I have known each other all our lives.
- {name} and I have known each other all our lives.
- This person and I have known each other all our lives. Who is this?
- Who is this?
- This person and I have known each other all our lives.

**“forever”**

- My {rel}, {name}, and I have known each other forever.
- {name} and I have known each other forever.
- This person and I have known each other forever. Who is this?
- Who is this?
- This person and I have known each other forever.
- I have known my {rel}, {name}, forever.
- I have known {name} forever.
- I have known this person forever. Who is this?
- I have known this person forever.

## home

**(empty)**

- (no sentence, so no card)

**“Ohio”**

- My {rel}, {name}, lives in Ohio.
- {name} lives in Ohio.
- Who lives in Ohio?
- This person lives in Ohio. Who is this?
- Who is this?
- This person lives in Ohio.
- My {rel} {name}’s home is in Ohio.
- {name}’s home is in Ohio.
- This person’s home is in Ohio. Who is this?
- This person’s home is in Ohio.

**“in Ohio”**

- My {rel}, {name}, lives in Ohio.
- {name} lives in Ohio.
- Who lives in Ohio?
- This person lives in Ohio. Who is this?
- Who is this?
- This person lives in Ohio.
- My {rel} {name}’s home is in Ohio.
- {name}’s home is in Ohio.
- This person’s home is in Ohio. Who is this?
- This person’s home is in Ohio.

**“the house next door”**

- My {rel}, {name}, lives in the house next door.
- {name} lives in the house next door.
- Who lives in the house next door?
- This person lives in the house next door. Who is this?
- Who is this?
- This person lives in the house next door.
- My {rel} {name}’s home is in the house next door.
- {name}’s home is in the house next door.
- This person’s home is in the house next door. Who is this?
- This person’s home is in the house next door.

**“Paris, France”**

- My {rel}, {name}, lives in Paris, France.
- {name} lives in Paris, France.
- Who lives in Paris, France?
- This person lives in Paris, France. Who is this?
- Who is this?
- This person lives in Paris, France.
- My {rel} {name}’s home is in Paris, France.
- {name}’s home is in Paris, France.
- This person’s home is in Paris, France. Who is this?
- This person’s home is in Paris, France.

**“an apartment”**

- My {rel}, {name}, lives in an apartment.
- {name} lives in an apartment.
- Who lives in an apartment?
- This person lives in an apartment. Who is this?
- Who is this?
- This person lives in an apartment.
- My {rel} {name}’s home is in an apartment.
- {name}’s home is in an apartment.
- This person’s home is in an apartment. Who is this?
- This person’s home is in an apartment.

## lives_with

**(empty)**

- (no sentence, so no card)

**“two roommates”**

- My {rel}, {name}, lives with two roommates.
- {name} lives with two roommates.
- Who lives with two roommates?
- This person lives with two roommates. Who is this?
- Who is this?
- This person lives with two roommates.
- My {rel}, {name}, shares a home with two roommates.
- {name} shares a home with two roommates.
- Who shares a home with two roommates?
- This person shares a home with two roommates. Who is this?
- This person shares a home with two roommates.

**“her husband”**

- My {rel}, {name}, lives with her husband.
- {name} lives with her husband.
- Who lives with her husband?
- This person lives with her husband. Who is this?
- Who is this?
- This person lives with her husband.
- My {rel}, {name}, shares a home with her husband.
- {name} shares a home with her husband.
- Who shares a home with her husband?
- This person shares a home with her husband. Who is this?
- This person shares a home with her husband.

**“Sam and the kids”**

- My {rel}, {name}, lives with Sam and the kids.
- {name} lives with Sam and the kids.
- Who lives with Sam and the kids?
- This person lives with Sam and the kids. Who is this?
- Who is this?
- This person lives with Sam and the kids.
- My {rel}, {name}, shares a home with Sam and the kids.
- {name} shares a home with Sam and the kids.
- Who shares a home with Sam and the kids?
- This person shares a home with Sam and the kids. Who is this?
- This person shares a home with Sam and the kids.

**“a cat”**

- My {rel}, {name}, lives with a cat.
- {name} lives with a cat.
- Who lives with a cat?
- This person lives with a cat. Who is this?
- Who is this?
- This person lives with a cat.
- My {rel}, {name}, shares a home with a cat.
- {name} shares a home with a cat.
- Who shares a home with a cat?
- This person shares a home with a cat. Who is this?
- This person shares a home with a cat.

**“alone”**

- My {rel}, {name}, lives alone.
- {name} lives alone.
- Who lives alone?
- This person lives alone. Who is this?
- Who is this?
- This person lives alone.

## partner

**(empty)**

- (no sentence, so no card)

**“Sam”**

- My {rel} {name}’s partner is Sam.
- {name}’s partner is Sam.
- Whose partner is Sam?
- This person’s partner is Sam. Who is this?
- Who is this?
- This person’s partner is Sam.
- My {rel}, {name}, and Sam are partners.
- {name} and Sam are partners.
- This person and Sam are partners. Who is this?
- This person and Sam are partners.

**“Sam and Alex”**

- My {rel}, {name}, has partners named Sam and Alex.
- {name} has partners named Sam and Alex.
- This person has partners named Sam and Alex. Who is this?
- Who is this?
- This person has partners named Sam and Alex.

## child

**(empty)**

- (no sentence, so no card)

**“Noah”**

- My {rel}, {name}, has a child named Noah.
- {name} has a child named Noah.
- Who has a child named Noah?
- This person has a child named Noah. Who is this?
- Who is this?
- This person has a child named Noah.
- My {rel}, {name}, is the parent of Noah.
- {name} is the parent of Noah.
- Who is the parent of Noah?
- This person is the parent of Noah. Who is this?
- This person is the parent of Noah.

**“Noah and Ava”**

- My {rel}, {name}, has children named Noah and Ava.
- {name} has children named Noah and Ava.
- Who has children named Noah and Ava?
- This person has children named Noah and Ava. Who is this?
- Who is this?
- This person has children named Noah and Ava.
- My {rel}, {name}, is the parent of Noah and Ava.
- {name} is the parent of Noah and Ava.
- Who is the parent of Noah and Ava?
- This person is the parent of Noah and Ava. Who is this?
- This person is the parent of Noah and Ava.

**“Noah, Ava and Liam”**

- My {rel}, {name}, has children named Noah, Ava, and Liam.
- {name} has children named Noah, Ava, and Liam.
- Who has children named Noah, Ava, and Liam?
- This person has children named Noah, Ava, and Liam. Who is this?
- Who is this?
- This person has children named Noah, Ava, and Liam.
- My {rel}, {name}, is the parent of Noah, Ava, and Liam.
- {name} is the parent of Noah, Ava, and Liam.
- Who is the parent of Noah, Ava, and Liam?
- This person is the parent of Noah, Ava, and Liam. Who is this?
- This person is the parent of Noah, Ava, and Liam.

**“two daughters”**

- My {rel}, {name}, has two daughters.
- {name} has two daughters.
- Who has two daughters?
- This person has two daughters. Who is this?
- Who is this?
- This person has two daughters.

**“a son”**

- My {rel}, {name}, has a son.
- {name} has a son.
- Who has a son?
- This person has a son. Who is this?
- Who is this?
- This person has a son.

## pet

**(empty)**

- (no sentence, so no card)

**“Rex”**

- My {rel}, {name}, has a pet named Rex.
- {name} has a pet named Rex.
- Who has a pet named Rex?
- This person has a pet named Rex. Who is this?
- Who is this?
- This person has a pet named Rex.

**“dog”**

- My {rel}, {name}, has a dog.
- {name} has a dog.
- Who has a dog?
- This person has a dog. Who is this?
- Who is this?
- This person has a dog.
- My {rel}, {name}, takes care of a dog.
- {name} takes care of a dog.
- Who takes care of a dog?
- This person takes care of a dog. Who is this?
- This person takes care of a dog.

**“two cats”**

- My {rel}, {name}, has two cats.
- {name} has two cats.
- Who has two cats?
- This person has two cats. Who is this?
- Who is this?
- This person has two cats.
- My {rel}, {name}, takes care of two cats.
- {name} takes care of two cats.
- Who takes care of two cats?
- This person takes care of two cats. Who is this?
- This person takes care of two cats.

**“an old cat”**

- My {rel}, {name}, has an old cat.
- {name} has an old cat.
- Who has an old cat?
- This person has an old cat. Who is this?
- Who is this?
- This person has an old cat.
- My {rel}, {name}, takes care of an old cat.
- {name} takes care of an old cat.
- Who takes care of an old cat?
- This person takes care of an old cat. Who is this?
- This person takes care of an old cat.

**“a dog named Rex”**

- My {rel}, {name}, has a dog named Rex.
- {name} has a dog named Rex.
- Who has a dog named Rex?
- This person has a dog named Rex. Who is this?
- Who is this?
- This person has a dog named Rex.
- My {rel}, {name}, takes care of a dog named Rex.
- {name} takes care of a dog named Rex.
- Who takes care of a dog named Rex?
- This person takes care of a dog named Rex. Who is this?
- This person takes care of a dog named Rex.

**“fish”**

- My {rel}, {name}, has a fish.
- {name} has a fish.
- Who has a fish?
- This person has a fish. Who is this?
- Who is this?
- This person has a fish.
- My {rel}, {name}, takes care of a fish.
- {name} takes care of a fish.
- Who takes care of a fish?
- This person takes care of a fish. Who is this?
- This person takes care of a fish.

**“Rex and Bella”**

- My {rel}, {name}, has pets named Rex and Bella.
- {name} has pets named Rex and Bella.
- Who has pets named Rex and Bella?
- This person has pets named Rex and Bella. Who is this?
- Who is this?
- This person has pets named Rex and Bella.

## marital

**(empty)**

- (no sentence, so no card)

**“married”**

- My {rel}, {name}, is married.
- {name} is married.
- This person is married. Who is this?
- Who is this?
- This person is married.

**“widowed”**

- My {rel}, {name}, is widowed.
- {name} is widowed.
- This person is widowed. Who is this?
- Who is this?
- This person is widowed.

**“single”**

- My {rel}, {name}, is single.
- {name} is single.
- This person is single. Who is this?
- Who is this?
- This person is single.

## situation

**(empty)**

- (no sentence, so no card)

**“expecting a baby”**

- My {rel}, {name}, is expecting a baby.
- {name} is expecting a baby.
- This person is expecting a baby. Who is this?
- Who is this?
- This person is expecting a baby.

**“a new grandparent”**

- My {rel}, {name}, is a new grandparent.
- {name} is a new grandparent.
- This person is a new grandparent. Who is this?
- Who is this?
- This person is a new grandparent.

**“retired”**

- My {rel}, {name}, is retired.
- {name} is retired.
- This person is retired. Who is this?
- Who is this?
- This person is retired.

**“is moving”**

- My {rel}, {name}, is moving.
- {name} is moving.
- This person is moving. Who is this?
- Who is this?
- This person is moving.

