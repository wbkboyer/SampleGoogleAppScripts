/*
 * Housekeeping
 */

// Add a custom menu to the active spreadsheet
function onOpen() {
    SpreadsheetApp.getUi()
        .createMenu('Kabam Game Jam Tools')
        .addItem('Get Winners', 'getListOfWinners')
        .addToUi();
}

// Trigger on installation of addon to spreadsheet
function onInstall() {
    onOpen();
}

// Three decimal point precision
var PRECISION_FACTOR = 1000

var ss = SpreadsheetApp.getActive();

// Want the range to exclude the first row and the first two columns (indexed 1 and 2)
var formResponse = ss.getSheetByName('Form Responses');
var responseLastRowIndex = formResponse.getLastRow();
var responseLastColIndex = formResponse.getLastColumn();
var responses = formResponse.getRange(2, 3, responseLastRowIndex - 1, responseLastColIndex - 2).getValues();

// Want the range to exclude the first row as well as the last two columns (final scores and
var scoreSheet = ss.getSheetByName('Scoring');
var rankingLastRowIndex = scoreSheet.getLastRow();
var rankingLastColIndex = scoreSheet.getLastColumn() - 2;
var rankValues = scoreSheet.getRange(2, 1, rankingLastRowIndex, rankingLastColIndex);

var rowToTeam = getTeamNames();
var colToCategory = getCategories();

function getTeamNames() {
  /**
   * @return dict mapping Team Name to row number
   */
  var teamNameCol = scoreSheet.getRange(2, 1, rankingLastRowIndex - 1).getValues();
  var rowToTeam = {};

  for (var i = 0; i < teamNameCol.length; i++) {
    // Recall: pertinent rows start at index 2 due to 1-indexing of row-col notation
    rowToTeam[i + 2] = teamNameCol[i][0];
  }
  return rowToTeam;
}

function getCategories() {
  /**
   * @return list of categories
   */
  var categoryRow = formResponse.getRange(1, 3, 1, responseLastColIndex - 2).getValues()[0];
  var colToCategory = {};
  for (var i = 0; i < categoryRow.length; i++) {
    // Recall: pertinent cols start at index 3 due to 1-indexing of row-col notation
    colToCategory[i + 3] = categoryRow[i];
  }
  return colToCategory;
}

/*
 * Meat and Potatoes
 */

function determineWinners( rankingTolerance ) {
  // Set tolerance to 0 (i.e. want to allow ties for scores that are within tolerance of eachother)
  rankingTolerance = rankingTolerance || 0.01;

  var finalScores = computeFinalScores();
  var winners = getListOfWinners(finalScores, rankingTolerance);
  var numWinners = winners.length;
  if (numWinners > 1) {
    winners = winners.join(', ');
  }
  else if (numWinners == 1) {
    winners = winners[0];
  }
  else {
    winners = 'No winners.';
  }
  scoreSheet.getRange(2, 10).setValue(winners);
}

function computeFinalScores() {
  // Iterate through form responses to tally votes and compute each team's rank in a category
  var tallies = computeTeamRankByCategory();

  // iterate over the column values in each row to compute the weighted score; might be nice to be able to get these values by parsing the cells, instead of having to statically  set
  var weights = {
                  'Creativity': 0.2,
                  'Playability': 0.4,
                  'Potential': 0.1,
                  'Stickiness': 0.1,
                  'Presentation': 0.1,
                  'Accessibility': 0.1,
                  'Extensibility': 0.05
                }

  // For rows 2 to final response
  var overallTeamScores = {};
  for (var team in tallies) {
    var overallTeamScore = 0;
    for (var category in tallies[team]) {
      if (category == 'teamName') {
        continue;
      }
      overallTeamScore += weights[category] * tallies[team][category]['rankScore'];
    }
    tallies[team]['overallTeamScore'] = overallTeamScore;
  }
  return tallies;
}

function computeTeamRankByCategory() {
  /**
   * Iterates over the tallies dictionary to add the rank in each category relative to other
   */
  var tallies = countTallies();
  var ranking = {}

  for (var category in colToCategory) {
    // recall row number to category ranking: ranking[<category>]
    ranking[colToCategory[category]] = {};
    for (var team in rowToTeam) {
      /*
       * ranking[<category>][<team name>] = {
       *                                      tally: <votes for team in category>,
       *                                      rank: <rank>,
       *                                      rankScore: <score>
       *                                    }
       */
      ranking[colToCategory[category]][rowToTeam[team]] = {
                                                          'teamName': rowToTeam[team],
                                                          'categoryName': colToCategory[category],
                                                          'tally': 0,
                                                          'voteShare': 0,
                                                          'rank': 0,
                                                          'rankScore': 0,
                                                        };
    }
    ranking[colToCategory[category]]['totalVotes'] = 0;
  }

  // For each team, look at the tallies for a given category; record this under
  // the record in the dictionary ranking under the current team for a category.
  for (var team in tallies) {
    for (var category in tallies[team]) {
      // ranking[<category>][<team name>]['tally'] = tallies[<team name>][<category>]['tally']
      var votesForCurrentTeamInCategory = tallies[team][category]['tally'];
      ranking[category][team]['tally'] = votesForCurrentTeamInCategory;
      ranking[category]['totalVotes'] += votesForCurrentTeamInCategory;
    }
  }

  // Then, take the tally that a team has for a given category and divide by the
  // total vote count for the category
  for (var category in ranking) {
    var teamsInCategory = ranking[category];

    var totalVotesForCategory = teamsInCategory['totalVotes'];
    for (var team in teamsInCategory) {
      if (teamsInCategory == 'totalVotes') {
        continue;
      }

      var teamScoringDict = teamsInCategory[team];
      teamScoringDict['voteProportion'] = Math.round(teamScoringDict['tally'] * PRECISION_FACTOR / totalVotesForCategory) / PRECISION_FACTOR;
    }

    var orderedByScores = orderByScore(teamsInCategory, 'voteProportion');

    /*
     * Maps score to Teams with that score so we can determine how many unique ranks there are.
     * Minimum: one key with all Teams, for when they all receive the same score in a category
     */
    var voteProportionToRank = assignRank(orderedByScores);

    // Finally, determine how many unique scores (i.e. of tallies over total)
    // there are (i.e. the total number of ranks)
    var numRanksForCategory = Object.keys(voteProportionToRank).length;

    for (var team in teamsInCategory) {
      var teamDetails = teamsInCategory[team];
      teamDetails['rankScore'] = Math.round(((numRanksForCategory - teamDetails['rank'] + 1) * PRECISION_FACTOR) / numRanksForCategory) / PRECISION_FACTOR;
    }
  }

  for (var team in tallies) {
    for (var category in tallies[team]) {
      tallies[team][category]['rank'] = ranking[category][team]['rank'];
      tallies[team][category]['rankScore'] = ranking[category][team]['rankScore'];
    }
    tallies[team]['teamName'] = team;
  }
  return tallies;
}

function countTallies() {
  /**
   * For each column (i.e. Scoring category) in the responses range,
   * iterate through all rows and count the number of votes for each
   * team in that category:
   *    Team A
   *      Category 1
   *        Tally
   *      Category 2
   *        Tally
   *      ...
   *    Team B
   *      Category 1
   *        Tally
   *      Category 2
   *        Tally
   *      ...
   *    ...
   * @return dict with keys being team names and values being dict of
   * category to dict including the tally
   */
  var tallies = {};
  for (var team in rowToTeam) {
    if (rowToTeam[team] in tallies) {
      continue;
    }
    // recall row number to team name mapping: tallies[<team name>]
    tallies[rowToTeam[team]] = {};
    for (var category in colToCategory) {
      if (colToCategory[category] in tallies[rowToTeam[team]]) {
        continue;
      }
      // recall column number to category mapping: tallies[<team name>][<category>]
      tallies[rowToTeam[team]][colToCategory[category]] = {
        'tally': 0
      };
    }
  }

  for (var i = 0; i < responseLastRowIndex - 1; i++) {
    for (var j = 0; j < responseLastColIndex - 2; j++) {
      // responses[i][j] will contain team name that the user voted best in that category
      tallies[responses[i][j]][colToCategory[j + 3]]['tally']++;
    }
  }

  return tallies;
}

function orderByScore(teams, orderCriterion){
  var orderedByScores = [];
  for (var team in teams) {
    if (team == 'totalVotes') {
      continue;
    }
    orderedByScores.push(teams[team]);
  }

  orderedByScores.sort(function(first, second) {
    return second[orderCriterion] - first[orderCriterion];
  });

  return orderedByScores;
}

function getListOfWinners(finalScores, rankingTolerance) {
  var teamsOrderedByScore = orderByScore(finalScores, 'overallTeamScore');
  var rankedTeams = assignRank(teamsOrderedByScore, 'overallTeamScore', rankingTolerance);
  var winners = [];

  for (var winner in rankedTeams[1]) {
    winners.push(rankedTeams[1][winner]['teamName']);
  }

  return winners;
}

function assignRank(orderedByScores, rankingCriterion, rankingTolerance) {
  rankingCriterion = rankingCriterion || 'voteProportion';
  rankingTolerance = rankingTolerance || 0;

  var rankedTeams = {};
  var previousTeamScore = orderedByScores[0][rankingCriterion];
  var rank = 1;
  for (var i = 0; i < orderedByScores.length; i++) {
    var currentTeam = orderedByScores[i];
    var currentTeamScore = currentTeam[rankingCriterion];
    if (currentTeamScore < previousTeamScore - rankingTolerance) {
      rank++;
      previousTeamScore = currentTeamScore;
    }

    currentTeam['rank'] = rank;

    if (!(rank in rankedTeams)) {
      rankedTeams[rank] = [currentTeam];
    }
    else {
      rankedTeams[rank].push(currentTeam);
    }
  }

  return rankedTeams
}
