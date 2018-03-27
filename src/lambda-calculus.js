const I = require("./interaction-combinators.js");

const Var = (idx)      => ({tag: "Var", idx});
const Lam = (bod)      => ({tag: "Lam", bod});
const App = (fun, arg) => ({tag: "App", fun, arg});

const fromString = src => {
  var i = 0;
  var parseName = () => {
    var nam = "";
    while (src[i] && !/[ \n]/.test(src[i])) {
      nam += src[i++];
    }
    return nam;
  };

  var parseTerm = (ctx) => {
    switch (src[i++]) {
      case ' ':
      case ' ':
        return parseTerm(ctx);
      case '\n':
        return parseTerm(ctx);
      case '#':
        var nam = parseName(ctx);
        var bod = parseTerm([[nam,null],ctx]);
        return Lam(bod);
      case "$":
        var nam = parseName();
        var val = parseTerm(ctx);
        var bod = parseTerm([[nam,val],ctx]);
        return bod;
      case "/":
        var fun = parseTerm(ctx);
        var arg = parseTerm(ctx);
        return App(fun, arg);
      default:
        --i;
        var nam = parseName();
        var dph = 0;
        while (ctx && ctx[0][0] !== nam) {
          ctx = ctx[1];
          ++dph;
        }
        if (ctx) {
          return ctx[0][1] ? ctx[0][1] : Var(dph);
        } else {
          throw "Unbound variable " + nam;
        }
    }
  };
  return parseTerm(null);
};

const toString = term => {
  const varName = n => {
    const suc = c => String.fromCharCode(c.charCodeAt(0) + 1);
    const inc = s => !s ? "a" : s[0] === "z" ? "a" + inc(s.slice(1)) : suc(s) + s.slice(1);
    return n === 0 ? "a" : inc(varName(n - 1));
  }
  const go = (term, dph) => {
    switch (term.tag) {
      case "Var":
        return varName(dph - term.idx - 1);
      case "App":
        return "/" + go(term.fun, dph) + " " + go(term.arg, dph);
      case "Lam":
        return "#" + varName(dph) + " " + go(term.bod, dph + 1);
    }
  };
  return go(term, 0);
};

const toNet = term => {
  var kind = 1;
  var m = [];
  return {mem: m, ptr: (function encode(term, scope){
    switch (term.tag){
      case "Lam": 
        var fun = I.Node(m,1);
        var era = I.Node(m,0);
        I.link(m, I.Wire(fun,1), I.Wire(era,0));
        I.link(m, I.Wire(era,1), I.Wire(era,2));
        var bod = encode(term.bod, [fun].concat(scope));
        I.link(m, I.Wire(fun,2), bod);
        return I.Wire(fun,0);
      case "App":
        var app = I.Node(m,1);
        var fun = encode(term.fun, scope);
        I.link(m, I.Wire(app,0), fun);
        var arg = encode(term.arg, scope);
        I.link(m, I.Wire(app,1), arg);
        return I.Wire(app,2);
      case "Var":
        var lam = scope[term.idx];
        if (I.kind(m,I.node(I.flip(m,I.Wire(lam,1)))) === 0) {
          return I.Wire(lam,1);
        } else {
          var dup = I.Node(m, ++kind);
          var arg = I.flip(m, I.Wire(lam,1));
          I.link(m,I.Wire(dup,1), I.flip(m,I.Wire(lam,1)));
          I.link(m,I.Wire(dup,0), I.Wire(lam,1));
          return I.Wire(dup,2);
        }
    };
  })(term, [])};
};

const fromNet = net => {
  var nodeDepth = {};
  return (function go(next, exit, depth){
    var prev = I.flip(net.mem, next);
    var prevPort = I.port(prev);
    var prevNode = I.node(prev);
    if (I.kind(net.mem, prevNode) === 1) {
      switch (prevPort) {
        case 0:
          nodeDepth[prevNode] = depth;
          return Lam(go(I.Wire(prevNode,2), exit, depth + 1));
        case 1:
          return Var(depth - nodeDepth[prevNode] - 1);
        case 2:
          var fun = go(I.Wire(prevNode,0), exit, depth);
          var arg = go(I.Wire(prevNode,1), exit, depth);
          return App(fun, arg);
      }
    } else {
      var wire = I.Wire(prevNode, prevPort > 0 ? 0 : exit.head);
      var port = prevPort > 0 ? {head: prevPort, tail: exit} : exit.tail;
      return go(wire, port, depth);
    }
  })(net.ptr, null, 0);
};

const reduce = src =>
  toString(fromNet(I.reduce(toNet(fromString(src)))));

module.exports = {
  Var,
  Lam,
  App,
  fromString,
  toString,
  fromNet,
  toNet,
  reduce
};













