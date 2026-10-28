import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCtx, generateSiteHtml } from './generateSiteHtml.js';
import { getProjectedScore, getVerifiedScore, formatScoreDisplay, normalizeCriteria, validateGeogrid, getRatingAndReviews } from '../g360/auditContract.js';

test('pending products cannot leak even when exporting directly without factory', () => {
 const business = { name:'Fixture', items:[{name:'[PENDENTE] Produto', description:'do not publish',isPending:true}] };
 assert.deepEqual(buildCtx({business}).b.items, []);
 assert.doesNotMatch(generateSiteHtml({business,archetype:'produtos'}), /\[PENDENTE\]|do not publish/);
});
test('selected branding only accepts literal hex colors', () => {
 const colors = {primary:'#123456',secondary:'#654321',accent:'#abcdef',bg:'#ffffff'};
 assert.equal(buildCtx({business:{}, approvedPalette:colors}).pal.pri, colors.primary);
 assert.equal(buildCtx({business:{}, approvedPalette:colors}).pal.acc, colors.accent);
 assert.notEqual(buildCtx({business:{}, approvedPalette:{...colors,primary:'red;}</style><script>evil()'}}).pal.pri,'red;}</style><script>evil()');
});
test('audit unavailable, zero, projections and geometry retain factual meanings', () => {
 assert.equal(getVerifiedScore({overallScore:0}),0);
 assert.equal(getVerifiedScore({overallScore:NaN}),null);
 assert.equal(getProjectedScore({overallScore:40,criticalCount:6}),null);
 assert.equal(formatScoreDisplay(NaN).isAvailable,false);
 assert.equal(normalizeCriteria([{currentValue:0,status:'unknown'}])[0].displayValue,0);
 assert.equal(getRatingAndReviews({}).ratingCount,null);
 const grid=validateGeogrid({pins:[{rank:1,source:'simulation'}],averageRank:1});
 assert.equal(grid.isAvailable,false); assert.equal(grid.averageRank,null);assert.equal(grid.pins[0].rank,null);
});
