/* Original editorial illustration. All motion is derived from composition time. */
(function (global) {
  'use strict';
  global.createWardenTeamScene = function ({ canvas, width = 1920, height = 1080 }) {
    canvas.width = width; canvas.height = height;
    const c = canvas.getContext('2d');
    const ink = '#172236', ivory = '#f1ede3';
    const people = [
      { x: 360, skin: '#c98f72', shade: '#ab6c53', hair: '#302828', shirt: '#8778bd', light: '#b4a5df', style: 0, team: 'Product', tool: 'Claude Code', task: 'Customer insights', color: '#f47583', result: 'Blocked', rule: 'Client data' },
      { x: 960, skin: '#edba92', shade: '#cf956f', hair: '#3c393c', shirt: '#426c65', light: '#78a093', style: 1, team: 'Engineering', tool: 'Codex', task: 'Pricing service', color: '#f1ca7e', result: 'Your review', rule: 'Sensitive request' },
      { x: 1560, skin: '#86553f', shade: '#65402f', hair: '#24272c', shirt: '#b78042', light: '#d7b27a', style: 2, team: 'Operations', tool: 'Compatible tools', task: 'Public help guide', color: '#9ce9c6', result: 'Allowed', rule: 'Public information' }
    ];
    const clamp = n => Math.max(0, Math.min(1, n));
    const smooth = n => { n = clamp(n); return n * n * (3 - 2 * n); };
    const path = (fill, draw, stroke, sw = 2) => {
      c.beginPath(); draw(); if (fill) { c.fillStyle = fill; c.fill(); }
      if (stroke) { c.strokeStyle = stroke; c.lineWidth = sw; c.stroke(); }
    };
    function box(x, y, w, h, r, fill, stroke) {
      path(fill, () => c.roundRect(x, y, w, h, r), stroke);
    }
    function ellipse(x, y, rx, ry, fill) {
      path(fill, () => c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2));
    }
    function line(points, color, sw = 2) {
      path(null, () => { c.moveTo(...points[0]); points.slice(1).forEach(p => c.lineTo(...p)); }, color, sw);
    }
    function text(str, x, y, size, color = ink, weight = 550, align = 'left') {
      c.fillStyle = color; c.font = `${weight} ${size}px WardenDisplay, Inter, sans-serif`;
      c.textAlign = align; c.fillText(str, x, y);
    }
    function star(x, y, color, s = 12) {
      path(color, () => {
        c.moveTo(x, y - s); c.quadraticCurveTo(x + 2, y - 2, x + s, y);
        c.quadraticCurveTo(x + 2, y + 2, x, y + s);
        c.quadraticCurveTo(x - 2, y + 2, x - s, y);
        c.quadraticCurveTo(x - 2, y - 2, x, y - s);
      });
    }
    function head(p, t, i) {
      const nod = 1.1 * Math.sin(t * 2.2 + i);
      c.save(); c.translate(0, nod);
      if (p.style === 0) {
        path(p.hair, () => {
          c.moveTo(-79, 408); c.bezierCurveTo(-103, 293, 98, 301, 83, 424);
          c.lineTo(101, 548); c.quadraticCurveTo(15, 580, -103, 545); c.closePath();
        });
      }
      box(-23, 478, 47, 67, 15, p.shade);
      path(p.skin, () => {
        c.moveTo(-64, 384); c.bezierCurveTo(-54, 323, 55, 326, 66, 384);
        c.lineTo(61, 449); c.quadraticCurveTo(48, 493, 9, 503);
        c.quadraticCurveTo(-25, 506, -49, 478);
        c.quadraticCurveTo(-64, 459, -64, 423); c.closePath();
      });
      ellipse(-64, 428, 11, 19, p.skin); ellipse(66, 427, 10, 19, p.skin);
      path(p.shade, () => {
        c.moveTo(42, 383); c.quadraticCurveTo(70, 397, 58, 454);
        c.quadraticCurveTo(43, 481, 9, 501); c.quadraticCurveTo(64, 495, 69, 438); c.closePath();
      });
      if (p.style === 0) {
        path(p.hair, () => {
          c.moveTo(-73, 410); c.quadraticCurveTo(-87, 329, -17, 323);
          c.quadraticCurveTo(70, 313, 76, 398); c.lineTo(55, 412);
          c.lineTo(42, 362); c.quadraticCurveTo(-12, 388, -48, 374); c.lineTo(-58, 428); c.closePath();
        });
      } else if (p.style === 1) {
        path(p.hair, () => {
          c.moveTo(-68, 418); c.lineTo(-72, 367); c.quadraticCurveTo(-62, 320, 12, 329);
          c.quadraticCurveTo(76, 337, 71, 399); c.lineTo(54, 423); c.lineTo(49, 375);
          c.quadraticCurveTo(14, 367, -39, 378); c.lineTo(-52, 422); c.closePath();
        });
      } else {
        for (let j = 0; j < 9; j++) {
          const a = Math.PI + j * Math.PI / 8;
          ellipse(Math.cos(a) * 52, 384 + Math.sin(a) * 42, 23, 26, p.hair);
        }
        box(-68, 372, 21, 51, 10, p.hair); box(48, 370, 22, 49, 10, p.hair);
      }
      // Forward gaze supports the presenting pose instead of suggesting typing.
      path(null, () => {
        c.moveTo(-39, 412); c.quadraticCurveTo(-28, 406, -16, 411);
        c.moveTo(17, 410); c.quadraticCurveTo(30, 405, 42, 411);
      }, p.hair, 3);
      ellipse(-28, 429, 9, 4.2, '#faf8f2'); ellipse(29, 429, 9, 4.2, '#faf8f2');
      ellipse(-28, 429, 2.8, 3.4, p.hair); ellipse(29, 429, 2.8, 3.4, p.hair);
      path(null, () => { c.moveTo(4, 425); c.lineTo(-2, 453); c.quadraticCurveTo(5, 457, 13, 453); }, p.shade, 2.3);
      path(null, () => { c.moveTo(-13, 475); c.quadraticCurveTo(3, 480, 19, 473); }, p.hair, 2);
      if (p.style === 1) {
        box(-48, 417, 42, 28, 8, null, ink); box(9, 417, 42, 28, 8, null, ink);
        line([[-6, 426], [9, 426]], ink, 2); line([[-49, 424], [-62, 419]], ink, 2);
      }
      c.restore();
    }
    function torso(p) {
      path(p.shirt, () => {
        c.moveTo(-134, 552); c.quadraticCurveTo(-104, 527, -34, 523);
        c.quadraticCurveTo(0, 550, 34, 523); c.quadraticCurveTo(105, 529, 134, 553);
        c.quadraticCurveTo(147, 652, 153, 801);
        c.quadraticCurveTo(0, 828, -153, 801);
        c.quadraticCurveTo(-148, 652, -134, 552); c.closePath();
      });
      if (p.style === 1) {
        path('#e4e4d5', () => { c.moveTo(-29, 532); c.lineTo(1, 574); c.lineTo(32, 531); c.lineTo(12, 675); c.lineTo(-16, 675); c.closePath(); });
        line([[-35, 534], [-60, 575], [-22, 593]], p.light, 3);
        line([[37, 536], [62, 575], [24, 595]], p.light, 3);
      } else {
        path(null, () => { c.moveTo(-35, 534); c.quadraticCurveTo(1, 569, 36, 534); }, p.light, 6);
      }
      line([[-115, 558], [-109, 578]], p.light, 2.5);
      line([[116, 558], [110, 578]], p.light, 2.5);
    }
    function arms(p) {
      // The upper arms descend outside the screen, elbows turn underneath the
      // device, and short forearms return inward to support its lower corners.
      // This whole silhouette is behind the laptop; the grip is a separate pass.
      for (const side of [-1, 1]) {
        c.save(); c.scale(side, 1);
        path(p.shirt, () => {
          c.moveTo(113, 541); c.quadraticCurveTo(149, 542, 167, 591);
          c.lineTo(209, 746); c.quadraticCurveTo(220, 779, 202, 791);
          c.quadraticCurveTo(186, 797, 170, 779); c.lineTo(150, 748);
          c.lineTo(174, 733); c.lineTo(189, 757);
          c.quadraticCurveTo(193, 763, 192, 753);
          c.lineTo(147, 626); c.quadraticCurveTo(135, 588, 111, 565); c.closePath();
        });
        // One elbow seam and one cuff; no long decorative finger/arm lines.
        path(null, () => { c.moveTo(188, 772); c.quadraticCurveTo(198, 779, 204, 771); }, p.light, 2.4);
        line([[155, 746], [174, 735]], p.light, 5);
        c.restore();
      }
    }
    function holdingHands(p) {
      for (const side of [-1, 1]) {
        c.save(); c.scale(side, 1);
        // Wrist joins the inward cuff; palm wraps the outside of the base.
        // The thumb rests on its outer deck and the grouped fingers curl under
        // the front lip. No hand enters the display or the keyboard key area.
        path(p.skin, () => {
          c.moveTo(158, 744); c.lineTo(176, 734);
          c.quadraticCurveTo(187, 746, 188, 759);
          c.quadraticCurveTo(189, 774, 177, 783);
          c.lineTo(163, 792); c.quadraticCurveTo(154, 796, 149, 789);
          c.quadraticCurveTo(146, 784, 153, 781);
          c.lineTo(167, 775); c.quadraticCurveTo(177, 769, 173, 761);
          c.lineTo(143, 755); c.quadraticCurveTo(134, 753, 136, 746);
          c.quadraticCurveTo(138, 740, 145, 742); c.lineTo(166, 748); c.closePath();
        });
        path(null, () => { c.moveTo(145, 750); c.lineTo(166, 756); }, p.shade, 1.6);
        path(null, () => { c.moveTo(155, 786); c.lineTo(167, 781); }, p.shade, 1.5);
        c.restore();
      }
    }
    const toolCue = i => [24.320987654320987, 24.790123456790123, 25.382716049382715][i];
    function connectionAt(t, i) {
      return smooth((t - toolCue(i) + .025) / .23);
    }
    function focusAt(t, i) {
      // Internal team-clock marks correspond to the spoken tool names in the
      // 28-second cut. A single focus pass per device keeps the list moving.
      const cue = toolCue(i);
      return smooth((t - cue + .07) / .09) * (1 - smooth((t - cue - .10) / .25));
    }
    function teamLabel(p) {
      // Functional teams stay identifiable across tasks, tool connections and
      // outcomes. The large labels carry the distinction at social-video scale.
      text(p.team, 0, 279, 52, ink, 650, 'center');
      box(-48, 296, 96, 4, 2, p.shirt);
    }
    function workPreview(p, progress, resultMix) {
      const accent = `rgb(${[1, 3, 5].map(at => {
        const from = parseInt(p.light.slice(at, at + 2), 16);
        const to = parseInt(p.color.slice(at, at + 2), 16);
        return Math.round(from + (to - from) * resultMix);
      }).join(',')})`;
      if (p.style === 0) {
        // Product: two customer-feedback rows, distinct from code or a checklist.
        for (let row = 0; row < 2; row++) {
          const y = 673 + row * 21, fill = row ? smooth((progress - .15) / .85) : progress;
          box(-126, y, 237, 16, 5, '#eeebf1');
          ellipse(-117, y + 8, 4.5, 4.5, p.shirt);
          box(-106, y + 5, row ? 139 : 191, 6, 3, '#d9d5e0');
          box(-106, y + 5, Math.max(3, (row ? 139 : 191) * fill), 6, 3, accent);
        }
      } else if (p.style === 1) {
        // Engineering: a readable code fragment, never a letter-by-letter reveal.
        box(-126, 672, 237, 38, 6, '#263544');
        line([[-115, 679], [-120, 684], [-115, 689]], p.light, 2);
        text('privateRates', -106, 691, 18, '#f8f7f0', 550);
        line([[36, 679], [41, 684], [36, 689]], p.light, 2);
        box(-106, 699, 195, 4, 2, '#52616c');
        box(-106, 699, Math.max(3, 195 * progress), 4, 2, accent);
      } else {
        // Operations: public documentation checklist; the same connection
        // progress activates the marks without changing its existing timing.
        ['Public FAQ', 'Release notes'].forEach((label, row) => {
          const y = 674 + row * 21, ready = progress >= (row ? .95 : .42);
          box(-126, y, 15, 15, 3, ready ? accent : '#e4e1d8');
          if (ready) line([[-123, y + 7], [-120, y + 10], [-115, y + 4]], ink, 1.8);
          text(label, -102, y + 13, 17, ink, 520);
        });
      }
    }
    function laptop(p, t, mode, i, focus = 0) {
      const start = mode === 'team' ? 12 : 24;
      const progress = mode === 'tools' || mode === 'control'
        ? connectionAt(t, i)
        : smooth((t - start - i * .09 - .10) / .55);
      // The open laptop faces the viewer, held against the torso. Its screen
      // rectangle is unchanged so the following camera portal retains its anchor.
      c.save(); c.shadowColor = '#1722362b'; c.shadowBlur = 17; c.shadowOffsetY = 10;
      box(-149, 572, 298, 202, 14, '#27313f'); c.restore();
      box(-151, 570, 302, 162, 13, '#27313f'); box(-139, 581, 278, 137, 7, '#f8f7f0');
      if (focus > 0) {
        c.save(); c.globalAlpha = focus * .8;
        box(-155, 566, 310, 170, 16, null, p.shirt);
        c.restore();
      }
      ellipse(0, 576, 2, 2, '#929aab');
      star(-119, 602, p.shirt, 9); text('AI workspace', -102, 610, 19, ink, 650);
      box(-126, 628, 251, 33, 7, '#e9e7e1'); text(p.task, -113, 651, 20, ink, 550);
      const resultMix = mode === 'tools' || mode === 'control' ? smooth((t - 26.15) / .4) : 0;
      workPreview(p, progress, resultMix);
      path('#c4c9ce', () => { c.moveTo(-151, 725); c.lineTo(151, 725); c.lineTo(177, 782); c.quadraticCurveTo(0, 794, -178, 782); c.closePath(); });
      for (let row = 0; row < 3; row++) for (let key = 0; key < 11; key++) {
        box(-116 + key * 22, 733 + row * 11, 18, 7, 2, '#8b959f');
      }
      box(-33, 770, 67, 14, 4, '#adb6bf'); line([[-168, 784], [167, 784]], '#9da7b2', 2);
      // Content stays visible while the device is presented; no typing cursor.
    }
    function outcome(p) {
      box(-153, 837, 306, 63, 31, p.color);
      const iconX = -119, iconY = 869;
      ellipse(iconX, iconY, 14, 14, ink);
      if (p.style === 0) line([[iconX - 6, iconY], [iconX + 6, iconY]], ivory, 3);
      if (p.style === 1) {
        line([[iconX - 3, iconY - 6], [iconX - 3, iconY + 6]], ivory, 2.5);
        line([[iconX + 4, iconY - 6], [iconX + 4, iconY + 6]], ivory, 2.5);
      }
      if (p.style === 2) line([[iconX - 6, iconY], [iconX - 1, iconY + 5], [iconX + 7, iconY - 5]], ivory, 2.5);
      text(p.result, 13, 882, 38, ink, 650, 'center');
      text(p.rule, 0, 938, 30, '#555966', 520, 'center');
    }
    function toolLabel(p, focus = 0, connection = 1) {
      // One intact phrase gets a small, anchored emphasis on its spoken beat.
      c.save(); c.translate(0, 861); c.scale(1 + focus * .045, 1 + focus * .045);
      if (focus > 0) {
        c.globalAlpha = focus * .8;
        box(-214, -35, 428, 65, 21, `${p.light}35`);
        c.globalAlpha = 1;
      }
      text(p.tool, 0, 15, 44, ink, 600, 'center'); c.restore();
      if (connection >= .98) {
        ellipse(-84, 917, 10, 10, '#426c65');
        line([[-89, 917], [-85, 921], [-79, 913]], '#f8f7f0', 2);
        text('Connected', 17, 926, 28, '#526b63', 550, 'center');
      } else {
        path(null, () => c.arc(-69, 917, 8, 0, Math.PI * 2), '#999b95', 2);
        text('Connect', 15, 926, 28, '#71756f', 550, 'center');
      }
    }
    function connectedOutcome(p, t, i) {
      // Only the label area changes. People and their completed work keep one pose.
      const reveal = smooth((t - 26.15 - i * .03) / .30);
      // Replace complete label groups sequentially; no moving crop across words.
      const outgoing = 1 - smooth(reveal / .42);
      const incoming = smooth((reveal - .42) / .58);
      if (outgoing > 0) {
        c.save(); c.globalAlpha *= outgoing;
        toolLabel(p, 0, connectionAt(t, i)); c.restore();
      }
      if (incoming > 0) {
        c.save(); c.globalAlpha *= incoming;
        outcome(p); c.restore();
      }
    }
    function review(t) {
      const p = { ...people[1], task: 'AI request' };
      c.save(); c.translate(440, 0);
      ellipse(0, 813, 195, 13, '#1722360c');
      torso(p); arms(p); head(p, t, 1); laptop(p, 25, 'tools', 1); holdingHands(p);
      text('Team lead', 0, 876, 44, ink, 600, 'center'); c.restore();
      // A single pending decision, presented front-on with generous button targets.
      c.save(); c.shadowColor = '#17223614'; c.shadowBlur = 28; c.shadowOffsetY = 14;
      box(814, 354, 854, 487, 24, '#faf8f1'); c.restore();
      box(814, 354, 854, 10, [24, 24, 0, 0], '#f1ca7e');
      text('Sensitive request', 860, 430, 52, ink, 650);
      text('Pricing and renewal terms', 860, 489, 36, '#555966', 500);
      line([[860, 526], [1622, 526]], '#dedbd2', 2);
      ellipse(879, 583, 19, 19, '#f1ca7e');
      line([[875, 575], [875, 591]], ink, 3); line([[883, 575], [883, 591]], ink, 3);
      text('Needs your review', 919, 596, 42, ink, 580);
      box(860, 669, 354, 100, 15, '#9ce9c6');
      box(1240, 669, 382, 100, 15, '#f4eeee', '#bf878c');
      text('Approve', 1037, 735, 46, ink, 650, 'center');
      text('Block', 1431, 735, 46, ink, 650, 'center');
      const move = smooth((t - 18.15) / 1.15), x = 1496 - move * 222, y = 804 - move * 21;
      // Rest between the controls. Neither action is selected or executed.
      path(ink, () => { c.moveTo(x, y); c.lineTo(x + 2, y + 28); c.lineTo(x + 10, y + 21); c.lineTo(x + 21, y + 25); c.closePath(); }, ivory, 2);
    }
    function renderAt(time, mode = 'team') {
      const t = Number.isFinite(time) ? time : 0;
      c.setTransform(width / 1920, 0, 0, height / 1080, 0, 0);
      c.clearRect(0, 0, 1920, 1080); c.lineCap = 'round'; c.lineJoin = 'round';
      if (mode === 'review') { review(t); return; }
      for (let i = 0; i < people.length; i++) {
        const p = people[i]; c.save(); c.translate(p.x, 0);
        // Soft lighting discs frame human silhouettes without adding UI containers.
        const glow = c.createRadialGradient(0, 560, 55, 0, 565, 272);
        glow.addColorStop(0, `${p.light}45`); glow.addColorStop(1, `${p.light}00`);
        c.fillStyle = glow; c.fillRect(-270, 293, 540, 526);
        ellipse(0, 813, 195, 13, '#1722360c');
        const focus = mode === 'tools' || mode === 'control' ? focusAt(t, i) : 0;
        if (focus > 0) {
          c.save(); c.globalAlpha = focus * .20;
          ellipse(0, 813, 186, 11, p.shirt); c.restore();
        }
        teamLabel(p);
        torso(p); arms(p); head(p, t, i); laptop(p, t, mode, i, focus); holdingHands(p);
        if (mode === 'control' || mode === 'tools') connectedOutcome(p, t, i);
        else text(p.task, 0, 876, 44, ink, 600, 'center');
        c.restore();
      }
    }
    return { renderAt };
  };
})(window);
