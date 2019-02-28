// What's being tested is that the policy-specific rules are being applied
// individually to each policy that they are applicable.
// For example: Policy 1 has a $10,000 premium, and the policy-specific rule
// requires a 15% DP. Policy 2 has a $100 premium and needs a 50% DP. The
// DP that should be returned is $1,550, not averaging 15% and 50%
// As long as all policy-specific and quote-specific rules have different DP %s,
// then we can verify that the policy-specific DP rules are used for their
// particular policy because the resulting DP % will have to match.

// Quote-specific criteria: total premium, renewal, state
// policy-specific criteria: coverage type, short rate, MEP, filings, policy duration,
  // auditable, additional days to cancel, policy premium

// Need 2 policies & 3 rules: 1 quote-specific & 2 policy-specific.
// Make a quote where both policy-specific rules apply, and average those terms.
// Also look at terms for the quote-specific rule. If they all have the same
// priority levels, then the most conservative of the quote terms should
// be returned.

// THIS ^ IS NOT ENTIRELY ACURATE ANYMORE BUT LEAVING IT BECAUSE THE GIST IS CORRECT 


describe('Make sure policy-specific rules are working correctly', function () {
  if (Cypress.env('skipSlowTests') === 'true') { return }

  beforeEach(() => {
    cy.creator.add('createDpTestsQuote').setParams({ policies: ['policy1', 'policy2'] });

    cy.creator.add('dpTestsDefaultDownPaymentTable')
      .include({
        downPaymentTable: ['dpTestsDefaultDownPaymentRule', 'luckyRule', 'bigBadRule'],
      });

    cy.creator.dup('basePolicy').as('policy1')
      .setAttributes({
        number: "Policy 1",
      });

    cy.creator.dup('dpTestsDefaultDownPaymentRule').as('luckyRule')
      .setAttributes({
        name: 'Lucky Rule',
        priority: 'low',
        default_down_payment_percentage: 20,
        min_down_payment_percentage: 15,
      })
      .include({
        downPaymentRule: 'luckyRequirement',
      });

    cy.creator.dup('variableRequirement').as('luckyRequirement')
      .setBelongsTo({
        downPaymentRule: 'luckyRule',
      });

    cy.creator.dup('basePolicy').as('policy2')
      .setAttributes({
        number: "Policy 2",
      });

    cy.creator.dup('dpTestsDefaultDownPaymentRule').as('bigBadRule')
      .setAttributes({
        name: 'Big Bad Rule',
        priority: 'low',
        default_down_payment_percentage: 30,
        min_down_payment_percentage: 30,
      });

    cy.creator.dup('variableRequirement').as('bigBadRequirement')
      .setBelongsTo({
        downPaymentRule: 'bigBadRule',
      });
  });

  it("Confirm coverage type and short rate are policy-specific rules", () => {
    cy.creator.find('policy1')
      .setAttributes({
        premium: 1000000  // $10,000
      })
      .setBelongsTo({
        coverageType: 'luckyCoverageType',
      });

    cy.creator.dup('baseCoverageType').as('luckyCoverageType')
      .setAttributes({ name: 'Lucky Coverage Type' });

    cy.creator.find('luckyRequirement')
      .setAttributes({
        criteria: 'coverage_type', // <- specific to quote
        comparison: 'equal_to',
        condition: 'Lucky Coverage Type'
      });

    cy.creator.find('policy2')
      .setAttributes({
        shortRate: true,
        premium: 10000,
      });

    cy.creator.find('bigBadRequirement')
      .setAttributes({
        criteria: 'short_rate', // <- specific to policy
        comparison: 'equal_to',
        condition: true,
      });


    cy.creator.create().then(() => {
      let quoteCreated = cy.creator.findResponse('dpTestsQuote');
      cy.get('body')
        .should(() => {
          expect(quoteCreated.downPayment).to.eq(203000) // $10,000 * 20% + $100 * 30%
        })
        .should(() => {
          expect(quoteCreated.minDownPayment).to.eq(153000) // $10,000 * 15% + $100 * 30%,
        });
    });
  });

  it("Confirm MEP and filings are policy-specific rules", () => {

    // Policy1 has the min_earned_percentage that meets the criteria for Lucky 7s
    cy.creator.find('policy1')
      .setAttributes({
        min_earned_percentage: 25,
        premium: 1000000  // $10,000
      });

    cy.creator.find('luckyRequirement')
      .setAttributes({
        criteria: 'minimum_earned_percentage',  // <- specific to quote
        comparison: 'equal_to',
        condition: '25',
      });


    // Policy2 is filings, matching Big Bad Rule
    cy.creator.find('policy2')
      .setAttributes({
        filings: true,
        premium: 1000000, // $10,000
      });

    cy.creator.find('bigBadRequirement')
      .setAttributes({
        criteria: 'filings', // <- specific to policy
        comparison: 'equal_to',
        condition: 'true',
      });


    cy.creator.create().then(() => {
      let quoteCreated = cy.creator.findResponse('dpTestsQuote');
      cy.get('body')
        .should(() => {
          expect(quoteCreated.downPayment).to.eq(500000) // $10,000 * 20% + $10,000 * 30%
        })
        .should(() => {
          expect(quoteCreated.minDownPayment).to.eq(450000) // $10,000 * 15% + $10,000 * 30%
        })
    })
  })

  it("Confirm policy duration and auditable rules are policy-specific rules", () => {

    cy.creator.find('policy1')
      .setAttributes({
        effectiveDate: "<%= Date.current %>",
        expirationDate: "<%= Date.current + 1.year + 6.month %>",
        premium: 100000  // $1,000
      });

    cy.creator.find('luckyRequirement')
      .setAttributes({
        criteria: 'policy_duration',  // <- specific to quote
        comparison: 'greater_than',
        condition: '400'
      });

    cy.creator.find('policy2')
      .setAttributes({
        auditable: true,
        premium: 1000000, // $10,000
      });

    cy.creator.find('bigBadRequirement')
      .setAttributes({
        criteria: 'auditable',
        comparison: 'equal_to',
        condition: 'true'
      });

    cy.creator.create().then(() => {
      let quoteCreated = cy.creator.findResponse('dpTestsQuote');
      cy.get('body')
        .should(() => {
          expect(quoteCreated.downPayment).to.eq(320000) // $1,000 * 20% + $10,000 * 30%
        })
        .should(() => {
          expect(quoteCreated.minDownPayment).to.eq(315000) // $10,000 * 15% + $10,000 * 30%
        })
    })
  })

  it("Confirm additional days to cancel and policy premium rules are policy-specific rules", () => {
    cy.creator.find('policy1')
      .setAttributes({
        additionalDaysToCancel: 10,
        premium: 100000  // $1,000
      });

    cy.creator.find('luckyRequirement')
      .setAttributes({
        criteria: 'additional_days_to_cancel',  // <- specific to quote
        comparison: 'greater_than',
        condition: '5'
      });


    cy.creator.find('policy2')
      .setAttributes({
        premium: 1000000, // $10,000
      });

    cy.creator.find('bigBadRequirement')
      .setAttributes({
        criteria: 'policy_premium',
        comparison: 'equal_to',
        condition: 1000000  // $10,000
      });

    cy.creator.create().then(() => {
      let quoteCreated = cy.creator.findResponse('dpTestsQuote');
      cy.get('body')
        .should(() => {
          expect(quoteCreated.downPayment).to.eq(320000) // $1,000 * 20% + $10,000 * 30%
        })
        .should(() => {
          expect(quoteCreated.minDownPayment).to.eq(315000) // $10,000 * 15% + $10,000 * 30%
        })
    })
  })

  it("The most conservative rules should be returned, even if they are quote-specific rules", () => {
    cy.creator.add('createDpTestsQuote').setParams({ policies: ['policy1', 'policy2', 'policy3'] });

    cy.creator.find('policy1')
      .setAttributes({
        additionalDaysToCancel: 10,
        premium: 100000  // $1,000
      });

    cy.creator.find('luckyRule')
      .setAttributes({
        installmentCountMax: 7, // most conservative 
      });

    cy.creator.find('luckyRequirement')
      .setAttributes({
        criteria: 'additional_days_to_cancel',  // <- specific to quote
        comparison: 'greater_than',
        condition: '5'
      });

    cy.creator.find('policy2')
      .setAttributes({
        premium: 1000000, // $10,000
      });

    cy.creator.find('bigBadRule')
      .setAttributes({
        installmentCountMax: 11,
      });

    cy.creator.find('bigBadRequirement')
      .setAttributes({
        criteria: 'policy_premium',
        comparison: 'equal_to',
        condition: 1000000  // $10,000
      });


    cy.creator.dup('dpTestsDefaultDownPaymentRule').as('quoteSpecificRule')
      .setAttributes({
        name: "Quote Specific Rule",
        defaultDownPaymentPercentage: 35,
        minDownPaymentPercentage: 35,
        installmentCountMin: 2,  // most conservative
        installmentCountMax: 10,
        installmentCountDefault: 5, // most conservative
        priority: "low",
        overrideMep: true,
        days_between_effective_date_and_first_due_date: "3",
        months_between_effective_date_and_first_due_date: "3"
      });

    cy.creator.dup('basePolicy').as('policy3')
      .setAttributes({
        number: "Policy 3",
        premium: 100000000,
        taxes: 100,
      });

    cy.creator.dup('variableRequirement').as('quoteSpecificRequirement')
      .setAttributes({
        criteria: "total_premium",
        comparison: "greater_than",
        condition: "100000000",
      })
      .setBelongsTo({
        downPaymentRule: 'quoteSpecificRule',
      });

      cy.creator.create()
        .then(() => {
          let quoteCreated = cy.creator.findResponse('dpTestsQuote');
          cy.get('body')
            .should(() => {
              expect(quoteCreated.installmentCount).to.eq(5)
            })
            .should(() => {
              expect(quoteCreated.installmentCountMin).to.eq(2)
            })
            .should(() => {
              expect(quoteCreated.installmentCountMax).to.eq(7)
            })
            // .should(() => {
            //   expect(quoteCreated.maxFirstDueDate).to.eq("<%= Date.current + 2.day + 2.month %>") // this is not how this works.  The string is embeded ruby
            // })
            .should(() => { // just testing the value, it's an aggregate not most conservative
              expect(quoteCreated.downPayment).to.eq(35320035)  // AUB this changed
            })
            .should(() => { // just testing the value, it's an aggregate not most conservative
              expect(quoteCreated.minDownPayment).to.eq(35315035)  // AUB this changed
            });
        });
  });
});