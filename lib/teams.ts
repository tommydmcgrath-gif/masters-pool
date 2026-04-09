/**
 * Pool team definitions.
 * To change teams, edit the entries below. Names should match what the
 * leaderboard API returns (the name-matching layer handles minor
 * differences like accents and abbreviations).
 */
export interface TeamDefinition {
  name: string;
  players: string[];
}

export const TEAMS: TeamDefinition[] = [
  {
    name: "Bryaan",
    players: [
      "Scottie Scheffler",
      "Hideki Matsuyama",
      "Min Woo Lee",
      "Collin Morikawa",
      "Si Woo Kim",
    ],
  },
  {
    name: "Tommy",
    players: [
      "Jon Rahm",
      "Patrick Reed",
      "Jordan Spieth",
      "Jake Knapp",
      "Jacob Bridgeman",
    ],
  },
  {
    name: "Tarte",
    players: [
      "Bryson DeChambeau",
      "Robert MacIntyre",
      "Akshay Bhatia",
      "J.J. Spaun",
      "Corey Conners",
    ],
  },
  {
    name: "Bwad",
    players: [
      "Rory McIlroy",
      "Tommy Fleetwood",
      "Justin Rose",
      "Viktor Hovland",
      "Maverick McNealy",
    ],
  },
  {
    name: "Cooper",
    players: [
      "Ludvig Åberg",
      "Matt Fitzpatrick",
      "Chris Gotterup",
      "Patrick Cantlay",
      "Justin Thomas",
    ],
  },
  {
    name: "Longman",
    players: [
      "Xander Schauffele",
      "Cameron Young",
      "Nicolai Højgaard",
      "Russell Henley",
      "Brooks Koepka",
    ],
  },
];
