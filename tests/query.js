"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const query_1 = require("../lib/query");
const l = require("../lib/language");
const { SELECT, CONDITIONS: { AND, OR }, COMPARISONS: { EQ, NOT, GT, GTE, LT, LTE, IN, BETWEEN, LIKE, EXISTS, NULL }, VALUES: V, PATH, UNION, UNIONALL, } = l;
const { DATA } = V;
function default_1() {
    describe('Query:', () => {
        it('TExpData', () => {
            const q = new query_1.Query();
            chai_1.assert.equal(q.TExpData(true), 'true');
            chai_1.assert.equal(q.TExpData(123), '123');
            chai_1.assert.equal(q.TExpData('123'), '$1');
            chai_1.assert.deepEqual(q.params, ['123']);
        });
        it('IExpValue', () => {
            const q = new query_1.Query();
            chai_1.assert.equal([
                q.IExpValue(DATA(true)),
                q.IExpValue(DATA(false).AS('a')),
                q.IExpValue(DATA(123)),
                q.IExpValue(DATA(123).AS('b')),
                q.IExpValue(DATA('123')),
                q.IExpValue(DATA('123').AS('c')),
                q.IExpValue(PATH('a').VALUE()),
                q.IExpValue(PATH('a').VALUE().AS('d')),
                q.IExpValue(PATH('a', 'b').VALUE()),
                q.IExpValue(PATH('a', 'b').VALUE().AS('e')),
            ], [
                `true`, `false as "a"`,
                `123`, `123 as "b"`,
                `$1`, `$2 as "c"`,
                `"a"`, `"a" as "d"`,
                `"a"."b"`, `"a"."b" as "e"`,
            ].join(','));
        });
        it('IExpAlias', () => {
            const q = new query_1.Query();
            chai_1.assert.equal(q.IExpAlias({ table: 'a' }), '"a"');
            chai_1.assert.equal(q.IExpAlias({ table: 'a', as: 'c' }), '"a" as "c"');
        });
        it('IExpWhat', () => {
            const q = new query_1.Query();
            chai_1.assert.equal(q.TExpWhat(), '*');
            chai_1.assert.equal(q.TExpWhat([]), '*');
            chai_1.assert.equal(q.TExpWhat([
                DATA(true),
                DATA(false).AS('a'),
                DATA(123),
                DATA(123).AS('b'),
                DATA('123'),
                DATA('123').AS('c'),
                PATH('a').VALUE(),
                PATH('a').VALUE().AS('d'),
                PATH('a', 'b').VALUE(),
                PATH('a', 'b').VALUE().AS('e'),
            ]), [
                `true`, `false as "a"`,
                `123`, `123 as "b"`,
                `$1`, `$2 as "c"`,
                `"a"`, `"a" as "d"`,
                `"a"."b"`, `"a"."b" as "e"`,
            ].join(','));
            chai_1.assert.deepEqual(q.params, ['123', '123']);
        });
        it('TExpFrom', () => {
            const q = new query_1.Query();
            chai_1.assert.throw(() => q.TExpFrom());
            chai_1.assert.throw(() => q.TExpFrom([]));
            chai_1.assert.equal(q.TExpFrom([{ table: 'a' }]), '"a"');
            chai_1.assert.equal(q.TExpFrom([{ table: 'a', as: 'c' }]), '"a" as "c"');
        });
        it('IExpComparison', () => {
            const q = new query_1.Query();
            const com = (exp, equal) => chai_1.assert.equal(q.IExpComparison(exp), equal);
            chai_1.assert.equal(q.IExpComparison({ values: [[DATA('a')]] }), '$1');
            chai_1.assert.equal(q.IExpComparison(EQ(PATH('a', 'b'), DATA('a'))), '"a"."b" = $2');
            chai_1.assert.equal(q.IExpComparison(IN(PATH('a', 'b'), DATA('a'), DATA('b'))), '"a"."b" in ($3,$4)');
            chai_1.assert.equal(q.IExpComparison(BETWEEN(PATH('a', 'b'), DATA('a'), DATA('b'))), '"a"."b" between $5 and $6');
            chai_1.assert.equal(q.IExpComparison(LIKE(PATH('a', 'b'), DATA('a'))), '"a"."b" like $7');
        });
        it('IExpCondition', () => {
            const q = new query_1.Query();
            chai_1.assert.equal(q.IExpCondition(AND(OR(EQ(PATH('a', 'b'), DATA('a')), GT(DATA(123), PATH('x', 'y'))), EQ(PATH('a', 'b'), DATA('a')), GT(DATA(123), PATH('x', 'y')))), '(("a"."b" = $1) or (123 > "x"."y")) and ("a"."b" = $2) and (123 > "x"."y")');
        });
        it('TExpGroup', () => {
            const q = new query_1.Query();
            chai_1.assert.equal(q.TExpGroup([PATH('a'), PATH('b', 'c')]), '"a","b"."c"');
        });
        it('TExpOrder', () => {
            const q = new query_1.Query();
            chai_1.assert.equal(q.TExpOrder([{ field: 'a' }, { alias: 'b', field: 'c', order: 'desc' }]), '"a" ASC,"b"."c" DESC');
        });
        it('IExpSelect', () => {
            const q = new query_1.Query();
            chai_1.assert.equal(q.IExp(SELECT('x', PATH('x', 'y'))
                .FROM({ table: 'a' })
                .WHERE(AND(OR(EQ(PATH('a', 'b'), DATA('a')), GT(DATA(123), PATH('x', 'y'))), EQ(PATH('a', 'b'), DATA('a')), GT(DATA(123), PATH('x', 'y'))))
                .GROUP(PATH('x'), PATH('y'))
                .ORDER(PATH('x')).ORDER(PATH('z', 'r'), false)
                .OFFSET(5).LIMIT(3)), 'select $1,"x"."y" from "a" where ' +
                '(("a"."b" = $2) or (123 > "x"."y")) and ("a"."b" = $3) and (123 > "x"."y") ' +
                'group by "x","y" ' +
                'order by "x" ASC,"z"."r" DESC ' +
                'offset 5 limit 3');
        });
        it('IExpUnion', () => {
            const q = new query_1.Query();
            const t = n => `(select * from "${n}")`;
            chai_1.assert.equal(q.IExp(UNION(SELECT().FROM({ table: 'a' }), SELECT().FROM({ table: 'b' }), SELECT().FROM({ table: 'c' }))), `${t('a')} union ${t('b')} union ${t('c')}`);
        });
        it('IExpUnionall', () => {
            const q = new query_1.Query();
            const t = n => `(select * from "${n}")`;
            chai_1.assert.equal(q.IExp(UNIONALL(SELECT().FROM({ table: 'a' }), SELECT().FROM({ table: 'b' }), SELECT().FROM({ table: 'c' }))), `${t('a')} union all ${t('b')} union all ${t('c')}`);
        });
    });
}
exports.default = default_1;
//# sourceMappingURL=query.js.map