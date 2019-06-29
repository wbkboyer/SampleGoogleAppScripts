# Voting Mechanism

1. Voters will say “This team was best in category X”
2. Votes will be tallied so that we can determine how many unique ranks we come up with, which will yield our rank score
    - e.g. If  we had the following tallies:
        - Team A got 30 votes for Best in X (rank 1)
        - Team B got 20 votes for Best in X (rank 2)
        - Team C got 10 votes for Best in X (rank 3)
        - Team D got 20 votes for Best in X (rank 2)
        - Team E got 10 votes for Best in X (rank 3)
        - Team F got 5 votes for Best in X   (rank 4)
   then since there are 6 teams with 4 unique ranks yielding 4 rank scores:
        - Team A is given 4/4 for their rank score for Category X
        - Team B is given 3/4 for their rank score for Category X
        - Team C is given 2/4 for their rank score for Category X
        - Team D is given 3/4 for their rank score for Category X
        - Team E is given 2/4 for their rank score for Category X
        - Team F is given 1/4 for their rank score for Category X
    i.e. Ties all get some rank `k` of a total number of ranks `n`, so the rank score is ((n - k + 1) / n)
3. The rank score for a given category will be multiplied by the weight of the category
    - e.g. For Team D in the example above, they received a rank score of 3/4 in Category X. If Category X is worth 30%, then the weighted rank score will be
        3/4 * 30
4. A Team's overall score is the sum over all categories of the weighted rank score as computed in steps 2 and 3
  - e.g. If Team D received a rank score of:
        - 3/4 in Category X (there were 4 unique scores among the 6 teams, and therefore 4 ranks for this category)
        - 4/5 in Category Y (there were 5 unique scores among the 6 teams, and therefore 5 ranks for this category)
        - 2/6 in Category Z (there were 6 unique scores and therefore 6 ranks for this category)
    and if
        - Category X is worth 30%
        - Category Y is worth 50%
        - Category Z is worth 20%
 then the weighted rank score will be
        3/4 * 30 + 4/5 * 50 + 2/6 * 20 = 22.5 + 40 + 6.7 = 69.2
5. The highest score overall will be winner, where we will allow ties for very close scores. Also, we will announce the winners in each category!
