# AI for Deformation Monitoring: Companion Apps

Interactive apps for the book *AI for Deformation Monitoring: Anomaly Detection, Trend Analysis and Early Warning for Surveyors and Engineers* by Yam Khoon Tor.

Each app runs a small simulated monitoring problem in the browser. Change a setting and the charts and results update at once. The apps are plain HTML and JavaScript with no outside libraries, so they work online and offline, and nothing is sent anywhere.

## Use online

Open **https://yamkhoontor.github.io/AIDeform/** and choose an app.

## Use offline

1. On this page, press **Code**, then **Download ZIP**.
2. Unzip the folder anywhere on your computer.
3. Open `index.html` in Chrome, Edge, Firefox or Safari.

## The apps

Labels follow Chapter 1 of the book: **Established** methods can be used routinely; **Early adoption** methods should run alongside an established method; **Experimental** methods are for study and trials only.

| App | Name | Chapter | Maturity | What it does |
|---|---|---|---|---|
| 1 | [Maturity Explorer](apps/app01-maturity-explorer.html) | 1 | Established, Early adoption, Experimental | See which methods suit a monitoring task and how mature each one is. |
| 2 | [Signal and Noise](apps/app02-signal-and-noise.html) | 2 | Established | Mix real movement, a thermal cycle and noise; find the smallest detectable change. |
| 3 | [Classical Toolkit](apps/app03-classical-toolkit.html) | 3 | Established | Least squares versus Huber, the Kalman filter's surprise value and the congruence test. |
| 4 | [Control Charts](apps/app04-control-charts.html) | 4 | Established | Tune CUSUM, EWMA and a rate rule on twelve settlement points beside an excavation. |
| 5 | [Ring Detectors](apps/app05-ring-detectors.html) | 5 | Early adoption | Plant outliers, drifts and shape changes in a tunnel ring; compare six detectors. |
| 6 | [Thermal Cycle and Detectors](apps/app06-thermal-cycle-detectors.html) | 6 | Experimental | See how a temperature input changes false alarms, and try an autoencoder. |
| 7 | [Instrument Fault or Movement?](apps/app07-fault-or-movement.html) | 7 | Established, Early adoption | Diagnose a jump, a station shift, refraction or real movement, with a classifier's suggestion. |
| 8 | [Thermal Separation](apps/app08-thermal-separation.html) | 8 | Established, Early adoption | Separate trend from the thermal cycle and find when the rate of movement changes. |
| 9 | [Forecast Lab](apps/app09-forecast-lab.html) | 9 | Established, Early adoption | Compare forecasts and check whether their uncertainty bands are honest. |
| 10 | [What Drives the Movement?](apps/app10-what-drives-the-movement.html) | 10 | Established, Early adoption | Set the true causes and see whether regression and machine learning recover them. |
| 11 | [Warning Calculator](apps/app11-warning-calculator.html) | 11 | Established, Early adoption | Work out time to threshold, probability of exceedance and the escalation stage. |
| 13 | [Tunnel Case Study](apps/app13-tunnel-case-study.html) | 13 | Established, Early adoption | Replay a 120-day tunnel monitoring project with your own trigger levels. |
| 14 | [Building and Bridge](apps/app14-building-and-bridge.html) | 14 | Established, Early adoption | See why removing the thermal effect first finds real movement sooner, with fewer false alarms. |
| 15 | [Spot the Mistake](apps/app15-spot-the-mistake.html) | 15 | Established | Six flawed analyses: find the mistake, then see the analysis done properly. |

Chapters 12 and 16 have no app.

## Notes

- All data are simulated and illustrative. Results are similar to, but not always identical with, the figures in the book.
- The apps are for education. They do not replace professional judgement, project specifications or statutory requirements.

## Copyright

Copyright © 2026 Yam Khoon Tor. All rights reserved. See [LICENSE.md](LICENSE.md).
