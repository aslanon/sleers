// Canvas tabanlı custom cursor

const canvas = document.createElement("canvas");
const ctx = canvas.getContext("2d");
document.body.appendChild(canvas);

canvas.style.position = "fixed";
canvas.style.top = 0;
canvas.style.left = 0;
canvas.style.pointerEvents = "none";
canvas.style.zIndex = 10000;

let width = window.innerWidth;
let height = window.innerHeight;
canvas.width = width;
canvas.height = height;

window.addEventListener("resize", () => {
	width = window.innerWidth;
	height = window.innerHeight;
	canvas.width = width;
	canvas.height = height;
});

let cursorX = width / 2;
let cursorY = height / 2;
let targetX = cursorX;
let targetY = cursorY;

const img = new Image();
img.src = "https://screen.studio/_next/static/media/pointer.4df84e61.svg";

const cursorSize = 80;
let currentScale = 1;
let targetScale = 1;
let rotation = 0;
let targetRotation = 0;
let warpX = 1;
let warpY = 1;
let targetWarpX = 1;
let targetWarpY = 1;

// Cursor hareket verisi (örnek)
const cursorData = [
	{ x: 1329, y: 659, timestamp: 372, cursorType: "default", type: "move" },
	{ x: 1329, y: 656, timestamp: 494, cursorType: "default", type: "move" },
	{ x: 1329, y: 651, timestamp: 573, cursorType: "default", type: "move" },
	{ x: 1329, y: 646, timestamp: 573, cursorType: "default", type: "move" },
	{ x: 1327, y: 640, timestamp: 573, cursorType: "default", type: "move" },
	{ x: 1326, y: 631, timestamp: 573, cursorType: "default", type: "move" },
	{ x: 1325, y: 623, timestamp: 573, cursorType: "default", type: "move" },
	{ x: 1323, y: 613, timestamp: 573, cursorType: "default", type: "move" },
	{ x: 1322, y: 603, timestamp: 573, cursorType: "default", type: "move" },
	{ x: 1322, y: 594, timestamp: 575, cursorType: "default", type: "move" },
	{ x: 1321, y: 583, timestamp: 575, cursorType: "default", type: "move" },
	{ x: 1320, y: 574, timestamp: 575, cursorType: "default", type: "move" },
	{ x: 1320, y: 571, timestamp: 575, cursorType: "default", type: "move" },
	{ x: 1320, y: 565, timestamp: 575, cursorType: "default", type: "move" },
	{ x: 1320, y: 560, timestamp: 575, cursorType: "default", type: "move" },
	{ x: 1320, y: 556, timestamp: 575, cursorType: "default", type: "move" },
	{ x: 1320, y: 553, timestamp: 575, cursorType: "default", type: "move" },
	{ x: 1320, y: 551, timestamp: 575, cursorType: "default", type: "move" },
	{ x: 1320, y: 548, timestamp: 575, cursorType: "default", type: "move" },
	{ x: 1320, y: 547, timestamp: 575, cursorType: "default", type: "move" },
	{ x: 1320, y: 546, timestamp: 575, cursorType: "default", type: "move" },
	{ x: 1320, y: 545, timestamp: 575, cursorType: "default", type: "move" },
	{ x: 1320, y: 545, timestamp: 584, cursorType: "default", type: "move" },
	{ x: 1320, y: 545, timestamp: 668, cursorType: "default", type: "move" },
	{ x: 1320, y: 545, timestamp: 669, cursorType: "default", type: "move" },
	{ x: 1320, y: 545, timestamp: 1365, cursorType: "default", type: "move" },
	{ x: 1320, y: 545, timestamp: 1366, cursorType: "default", type: "move" },
	{ x: 1320, y: 545, timestamp: 1368, cursorType: "default", type: "move" },
	{ x: 1320, y: 545, timestamp: 1377, cursorType: "default", type: "move" },
	{ x: 1322, y: 545, timestamp: 1399, cursorType: "default", type: "move" },
	{ x: 1326, y: 546, timestamp: 1409, cursorType: "default", type: "move" },
	{ x: 1334, y: 546, timestamp: 1477, cursorType: "default", type: "move" },
	{ x: 1343, y: 547, timestamp: 1477, cursorType: "default", type: "move" },
	{ x: 1355, y: 548, timestamp: 1478, cursorType: "default", type: "move" },
	{ x: 1367, y: 549, timestamp: 1478, cursorType: "default", type: "move" },
	{ x: 1382, y: 554, timestamp: 1478, cursorType: "default", type: "move" },
	{ x: 1397, y: 558, timestamp: 1478, cursorType: "default", type: "move" },
	{ x: 1416, y: 564, timestamp: 1478, cursorType: "default", type: "move" },
	{ x: 1432, y: 572, timestamp: 1478, cursorType: "default", type: "move" },
	{ x: 1451, y: 583, timestamp: 1478, cursorType: "default", type: "move" },
	{ x: 1487, y: 607, timestamp: 1478, cursorType: "default", type: "move" },
	{ x: 1513, y: 629, timestamp: 1484, cursorType: "default", type: "move" },
	{ x: 1543, y: 656, timestamp: 1488, cursorType: "default", type: "move" },
	{ x: 1574, y: 687, timestamp: 1500, cursorType: "default", type: "move" },
	{ x: 1603, y: 719, timestamp: 1503, cursorType: "default", type: "move" },
	{ x: 1634, y: 755, timestamp: 1512, cursorType: "default", type: "move" },
	{ x: 1644, y: 769, timestamp: 1520, cursorType: "default", type: "move" },
	{ x: 1670, y: 800, timestamp: 1527, cursorType: "default", type: "move" },
	{ x: 1689, y: 828, timestamp: 1535, cursorType: "default", type: "move" },
	{ x: 1705, y: 853, timestamp: 1543, cursorType: "default", type: "move" },
	{ x: 1710, y: 862, timestamp: 1558, cursorType: "default", type: "move" },
	{ x: 1721, y: 881, timestamp: 1559, cursorType: "default", type: "move" },
	{ x: 1727, y: 894, timestamp: 1567, cursorType: "default", type: "move" },
	{ x: 1727, y: 898, timestamp: 1577, cursorType: "default", type: "move" },
	{ x: 1730, y: 907, timestamp: 1584, cursorType: "default", type: "move" },
	{ x: 1730, y: 912, timestamp: 1595, cursorType: "default", type: "move" },
	{ x: 1731, y: 917, timestamp: 1605, cursorType: "default", type: "move" },
	{ x: 1731, y: 920, timestamp: 1615, cursorType: "default", type: "move" },
	{ x: 1731, y: 922, timestamp: 1622, cursorType: "default", type: "move" },
	{ x: 1731, y: 924, timestamp: 1637, cursorType: "default", type: "move" },
	{ x: 1731, y: 925, timestamp: 1637, cursorType: "default", type: "move" },
	{ x: 1731, y: 926, timestamp: 1645, cursorType: "default", type: "move" },
	{ x: 1731, y: 927, timestamp: 1647, cursorType: "default", type: "move" },
	{ x: 1731, y: 928, timestamp: 1655, cursorType: "default", type: "move" },
	{ x: 1731, y: 930, timestamp: 1664, cursorType: "default", type: "move" },
	{ x: 1731, y: 931, timestamp: 1728, cursorType: "default", type: "move" },
	{ x: 1732, y: 931, timestamp: 1728, cursorType: "default", type: "move" },
	{ x: 1732, y: 932, timestamp: 1728, cursorType: "default", type: "move" },
	{ x: 1733, y: 932, timestamp: 1728, cursorType: "default", type: "move" },
	{ x: 1733, y: 933, timestamp: 1728, cursorType: "default", type: "move" },
	{ x: 1733, y: 933, timestamp: 1728, cursorType: "default", type: "move" },
	{ x: 1733, y: 933, timestamp: 1728, cursorType: "default", type: "move" },
	{ x: 1734, y: 933, timestamp: 1733, cursorType: "default", type: "move" },
	{ x: 1734, y: 933, timestamp: 1751, cursorType: "default", type: "move" },
	{ x: 1734, y: 933, timestamp: 1760, cursorType: "default", type: "move" },
	{ x: 1734, y: 934, timestamp: 1796, cursorType: "default", type: "move" },
	{ x: 1734, y: 934, timestamp: 1832, cursorType: "default", type: "move" },
	{ x: 1734, y: 934, timestamp: 1854, cursorType: "default", type: "move" },
	{ x: 1734, y: 934, timestamp: 1865, cursorType: "default", type: "move" },
	{ x: 1734, y: 934, timestamp: 1890, cursorType: "default", type: "move" },
	{
		x: 1734,
		y: 934,
		timestamp: 1911,
		cursorType: "pointer",
		type: "mousedown",
		button: 1,
		clickCount: 1,
	},
	{ x: 1734, y: 934, timestamp: 2011, cursorType: "pointer", type: "scale" },
	{ x: 1734, y: 934, timestamp: 2111, cursorType: "pointer", type: "scale" },
	{ x: 1734, y: 934, timestamp: 2138, cursorType: "pointer", type: "move" },
	{ x: 1733, y: 934, timestamp: 2155, cursorType: "pointer", type: "move" },
	{ x: 1730, y: 934, timestamp: 2178, cursorType: "pointer", type: "move" },
	{ x: 1725, y: 934, timestamp: 2187, cursorType: "pointer", type: "move" },
	{ x: 1719, y: 934, timestamp: 2204, cursorType: "pointer", type: "move" },
	{ x: 1711, y: 935, timestamp: 2226, cursorType: "pointer", type: "move" },
	{ x: 1700, y: 936, timestamp: 2246, cursorType: "pointer", type: "move" },
	{ x: 1683, y: 938, timestamp: 2268, cursorType: "pointer", type: "move" },
	{ x: 1668, y: 939, timestamp: 2273, cursorType: "pointer", type: "move" },
	{ x: 1655, y: 940, timestamp: 2277, cursorType: "pointer", type: "move" },
	{ x: 1635, y: 940, timestamp: 2279, cursorType: "pointer", type: "move" },
	{ x: 1604, y: 940, timestamp: 2287, cursorType: "pointer", type: "move" },
	{ x: 1571, y: 938, timestamp: 2295, cursorType: "pointer", type: "move" },
	{ x: 1533, y: 933, timestamp: 2309, cursorType: "pointer", type: "move" },
	{ x: 1486, y: 925, timestamp: 2314, cursorType: "pointer", type: "move" },
	{ x: 1433, y: 915, timestamp: 2321, cursorType: "pointer", type: "move" },
	{ x: 1373, y: 903, timestamp: 2329, cursorType: "pointer", type: "move" },
	{ x: 1296, y: 886, timestamp: 2338, cursorType: "pointer", type: "move" },
	{ x: 1181, y: 857, timestamp: 2354, cursorType: "pointer", type: "move" },
	{ x: 1031, y: 814, timestamp: 2371, cursorType: "pointer", type: "move" },
	{ x: 867, y: 759, timestamp: 2391, cursorType: "pointer", type: "move" },
	{ x: 728, y: 704, timestamp: 2420, cursorType: "pointer", type: "move" },
	{ x: 612, y: 655, timestamp: 2425, cursorType: "pointer", type: "move" },
	{ x: 526, y: 616, timestamp: 2437, cursorType: "pointer", type: "move" },
	{ x: 467, y: 584, timestamp: 2456, cursorType: "pointer", type: "move" },
	{ x: 424, y: 558, timestamp: 2471, cursorType: "pointer", type: "move" },
	{ x: 406, y: 545, timestamp: 2488, cursorType: "pointer", type: "move" },
	{ x: 393, y: 536, timestamp: 2494, cursorType: "pointer", type: "move" },
	{ x: 382, y: 527, timestamp: 2494, cursorType: "pointer", type: "move" },
	{ x: 377, y: 522, timestamp: 2513, cursorType: "pointer", type: "move" },
	{ x: 373, y: 519, timestamp: 2517, cursorType: "pointer", type: "move" },
	{ x: 369, y: 516, timestamp: 2522, cursorType: "pointer", type: "move" },
	{ x: 366, y: 513, timestamp: 2528, cursorType: "pointer", type: "move" },
	{ x: 364, y: 511, timestamp: 2537, cursorType: "pointer", type: "move" },
	{ x: 362, y: 510, timestamp: 2545, cursorType: "pointer", type: "move" },
	{ x: 361, y: 509, timestamp: 2555, cursorType: "pointer", type: "move" },
	{ x: 361, y: 509, timestamp: 2588, cursorType: "pointer", type: "move" },
	{
		x: 361,
		y: 509,
		timestamp: 2921,
		cursorType: "default",
		type: "mouseup",
		button: 1,
	},
	{ x: 361, y: 509, timestamp: 3451, cursorType: "default", type: "move" },
	{ x: 362, y: 509, timestamp: 3460, cursorType: "default", type: "move" },
	{ x: 364, y: 509, timestamp: 3470, cursorType: "default", type: "move" },
	{ x: 368, y: 509, timestamp: 3475, cursorType: "default", type: "move" },
	{ x: 371, y: 509, timestamp: 3484, cursorType: "default", type: "move" },
	{ x: 377, y: 509, timestamp: 3495, cursorType: "default", type: "move" },
	{ x: 387, y: 509, timestamp: 3500, cursorType: "default", type: "move" },
	{ x: 397, y: 509, timestamp: 3513, cursorType: "default", type: "move" },
	{ x: 411, y: 508, timestamp: 3516, cursorType: "default", type: "move" },
	{ x: 442, y: 507, timestamp: 3524, cursorType: "default", type: "move" },
	{ x: 470, y: 507, timestamp: 3532, cursorType: "default", type: "move" },
	{ x: 507, y: 507, timestamp: 3545, cursorType: "default", type: "move" },
	{ x: 552, y: 507, timestamp: 3564, cursorType: "default", type: "move" },
	{ x: 604, y: 507, timestamp: 3574, cursorType: "default", type: "move" },
	{ x: 664, y: 510, timestamp: 3574, cursorType: "default", type: "move" },
	{ x: 779, y: 518, timestamp: 3579, cursorType: "default", type: "move" },
	{ x: 850, y: 524, timestamp: 3580, cursorType: "default", type: "move" },
	{ x: 928, y: 529, timestamp: 3588, cursorType: "default", type: "move" },
	{ x: 965, y: 532, timestamp: 3597, cursorType: "default", type: "move" },
	{ x: 1039, y: 538, timestamp: 3621, cursorType: "default", type: "move" },
	{ x: 1106, y: 544, timestamp: 3627, cursorType: "default", type: "move" },
	{ x: 1165, y: 554, timestamp: 3627, cursorType: "default", type: "move" },
	{ x: 1187, y: 559, timestamp: 3634, cursorType: "default", type: "move" },
	{ x: 1229, y: 570, timestamp: 3637, cursorType: "default", type: "move" },
	{ x: 1261, y: 580, timestamp: 3645, cursorType: "default", type: "move" },
	{ x: 1270, y: 584, timestamp: 3652, cursorType: "default", type: "move" },
	{ x: 1276, y: 586, timestamp: 3665, cursorType: "default", type: "move" },
	{ x: 1291, y: 592, timestamp: 3687, cursorType: "default", type: "move" },
	{ x: 1300, y: 596, timestamp: 3694, cursorType: "default", type: "move" },
	{ x: 1305, y: 598, timestamp: 3694, cursorType: "default", type: "move" },
	{ x: 1307, y: 600, timestamp: 3699, cursorType: "default", type: "move" },
	{ x: 1309, y: 601, timestamp: 3701, cursorType: "default", type: "move" },
	{ x: 1310, y: 601, timestamp: 3711, cursorType: "default", type: "move" },
	{ x: 1310, y: 602, timestamp: 3716, cursorType: "default", type: "move" },
	{ x: 1311, y: 602, timestamp: 3738, cursorType: "default", type: "move" },
	{ x: 1311, y: 602, timestamp: 3742, cursorType: "default", type: "move" },
	{ x: 1311, y: 602, timestamp: 3749, cursorType: "default", type: "move" },
	{ x: 1310, y: 603, timestamp: 4205, cursorType: "default", type: "move" },
	{ x: 1310, y: 606, timestamp: 4213, cursorType: "default", type: "move" },
	{ x: 1308, y: 612, timestamp: 4222, cursorType: "default", type: "move" },
	{ x: 1304, y: 621, timestamp: 4231, cursorType: "default", type: "move" },
	{ x: 1295, y: 646, timestamp: 4242, cursorType: "default", type: "move" },
	{ x: 1285, y: 673, timestamp: 4245, cursorType: "default", type: "move" },
	{ x: 1269, y: 709, timestamp: 4254, cursorType: "default", type: "move" },
	{ x: 1251, y: 748, timestamp: 4261, cursorType: "default", type: "move" },
	{ x: 1231, y: 797, timestamp: 4270, cursorType: "default", type: "move" },
	{ x: 1209, y: 849, timestamp: 4279, cursorType: "default", type: "move" },
	{ x: 1191, y: 899, timestamp: 4288, cursorType: "default", type: "move" },
	{ x: 1174, y: 946, timestamp: 4295, cursorType: "default", type: "move" },
	{ x: 1160, y: 990, timestamp: 4301, cursorType: "default", type: "move" },
	{ x: 1156, y: 1007, timestamp: 4319, cursorType: "default", type: "move" },
	{ x: 1147, y: 1038, timestamp: 4319, cursorType: "default", type: "move" },
	{ x: 1145, y: 1050, timestamp: 4325, cursorType: "default", type: "move" },
	{ x: 1140, y: 1074, timestamp: 4334, cursorType: "default", type: "move" },
	{ x: 1137, y: 1091, timestamp: 4344, cursorType: "default", type: "move" },
	{ x: 1137, y: 1095, timestamp: 4350, cursorType: "default", type: "move" },
	{ x: 1136, y: 1106, timestamp: 4362, cursorType: "default", type: "move" },
	{ x: 1135, y: 1112, timestamp: 4369, cursorType: "default", type: "move" },
	{ x: 1135, y: 1115, timestamp: 4379, cursorType: "default", type: "move" },
	{ x: 1134, y: 1118, timestamp: 4383, cursorType: "default", type: "move" },
	{ x: 1134, y: 1119, timestamp: 4390, cursorType: "default", type: "move" },
	{ x: 1134, y: 1119, timestamp: 4399, cursorType: "default", type: "move" },
	{ x: 1134, y: 1120, timestamp: 4405, cursorType: "default", type: "move" },
	{ x: 1134, y: 1120, timestamp: 4414, cursorType: "default", type: "move" },
	{ x: 1134, y: 1120, timestamp: 4423, cursorType: "default", type: "move" },
	{ x: 1134, y: 1120, timestamp: 4622, cursorType: "default", type: "move" },
	{ x: 1134, y: 1120, timestamp: 4631, cursorType: "default", type: "move" },
	{ x: 1134, y: 1119, timestamp: 4650, cursorType: "default", type: "move" },
	{ x: 1134, y: 1118, timestamp: 4651, cursorType: "default", type: "move" },
	{ x: 1134, y: 1117, timestamp: 4655, cursorType: "default", type: "move" },
	{ x: 1134, y: 1115, timestamp: 4662, cursorType: "default", type: "move" },
	{ x: 1134, y: 1112, timestamp: 4670, cursorType: "default", type: "move" },
	{ x: 1134, y: 1110, timestamp: 4679, cursorType: "default", type: "move" },
	{ x: 1134, y: 1108, timestamp: 4687, cursorType: "default", type: "move" },
	{ x: 1134, y: 1105, timestamp: 4695, cursorType: "default", type: "move" },
	{ x: 1134, y: 1102, timestamp: 4705, cursorType: "default", type: "move" },
	{ x: 1134, y: 1100, timestamp: 4713, cursorType: "default", type: "move" },
	{ x: 1135, y: 1098, timestamp: 4718, cursorType: "default", type: "move" },
	{ x: 1135, y: 1096, timestamp: 4726, cursorType: "default", type: "move" },
	{ x: 1135, y: 1096, timestamp: 4734, cursorType: "default", type: "move" },
	{ x: 1135, y: 1095, timestamp: 4742, cursorType: "default", type: "move" },
	{ x: 1135, y: 1095, timestamp: 4770, cursorType: "default", type: "move" },
	{ x: 1135, y: 1095, timestamp: 4770, cursorType: "default", type: "move" },
	{ x: 1135, y: 1094, timestamp: 4783, cursorType: "default", type: "move" },
	{ x: 1135, y: 1094, timestamp: 4790, cursorType: "default", type: "move" },
	{ x: 1135, y: 1093, timestamp: 4800, cursorType: "default", type: "move" },
	{ x: 1136, y: 1090, timestamp: 4807, cursorType: "default", type: "move" },
	{ x: 1137, y: 1085, timestamp: 4816, cursorType: "default", type: "move" },
	{ x: 1140, y: 1076, timestamp: 4823, cursorType: "default", type: "move" },
	{ x: 1147, y: 1056, timestamp: 4831, cursorType: "default", type: "move" },
	{ x: 1157, y: 1029, timestamp: 4842, cursorType: "default", type: "move" },
	{ x: 1179, y: 968, timestamp: 4849, cursorType: "default", type: "move" },
	{ x: 1199, y: 916, timestamp: 4855, cursorType: "default", type: "move" },
	{ x: 1221, y: 852, timestamp: 4863, cursorType: "default", type: "move" },
	{ x: 1249, y: 781, timestamp: 4871, cursorType: "default", type: "move" },
	{ x: 1277, y: 707, timestamp: 4880, cursorType: "default", type: "move" },
	{ x: 1289, y: 675, timestamp: 4889, cursorType: "default", type: "move" },
	{ x: 1315, y: 612, timestamp: 4896, cursorType: "default", type: "move" },
	{ x: 1323, y: 592, timestamp: 4903, cursorType: "default", type: "move" },
	{ x: 1343, y: 547, timestamp: 4912, cursorType: "default", type: "move" },
	{ x: 1347, y: 535, timestamp: 4923, cursorType: "default", type: "move" },
	{ x: 1359, y: 509, timestamp: 4929, cursorType: "default", type: "move" },
	{ x: 1362, y: 504, timestamp: 4935, cursorType: "default", type: "move" },
	{ x: 1368, y: 491, timestamp: 4945, cursorType: "default", type: "move" },
	{ x: 1371, y: 484, timestamp: 4951, cursorType: "default", type: "move" },
	{ x: 1373, y: 480, timestamp: 4997, cursorType: "default", type: "move" },
	{ x: 1373, y: 478, timestamp: 5002, cursorType: "default", type: "move" },
	{ x: 1374, y: 477, timestamp: 5006, cursorType: "default", type: "move" },
	{ x: 1375, y: 476, timestamp: 5006, cursorType: "default", type: "move" },
	{ x: 1375, y: 476, timestamp: 5006, cursorType: "default", type: "move" },
	{ x: 1374, y: 476, timestamp: 5229, cursorType: "default", type: "move" },
	{ x: 1371, y: 475, timestamp: 5238, cursorType: "default", type: "move" },
	{ x: 1363, y: 475, timestamp: 5240, cursorType: "default", type: "move" },
	{ x: 1351, y: 475, timestamp: 5248, cursorType: "default", type: "move" },
	{ x: 1336, y: 475, timestamp: 5256, cursorType: "default", type: "move" },
	{ x: 1300, y: 475, timestamp: 5263, cursorType: "default", type: "move" },
	{ x: 1269, y: 483, timestamp: 5272, cursorType: "default", type: "move" },
	{ x: 1232, y: 501, timestamp: 5280, cursorType: "default", type: "move" },
	{ x: 1191, y: 527, timestamp: 5289, cursorType: "default", type: "move" },
	{ x: 1150, y: 556, timestamp: 5296, cursorType: "default", type: "move" },
	{ x: 1114, y: 590, timestamp: 5306, cursorType: "default", type: "move" },
	{ x: 1101, y: 605, timestamp: 5316, cursorType: "default", type: "move" },
	{ x: 1078, y: 637, timestamp: 5319, cursorType: "default", type: "move" },
	{ x: 1072, y: 648, timestamp: 5328, cursorType: "default", type: "move" },
	{ x: 1061, y: 671, timestamp: 5368, cursorType: "default", type: "move" },
	{ x: 1057, y: 687, timestamp: 5376, cursorType: "default", type: "move" },
	{ x: 1057, y: 699, timestamp: 5394, cursorType: "default", type: "move" },
	{ x: 1057, y: 712, timestamp: 5395, cursorType: "default", type: "move" },
	{ x: 1060, y: 716, timestamp: 5395, cursorType: "default", type: "move" },
	{ x: 1078, y: 721, timestamp: 5401, cursorType: "default", type: "move" },
	{ x: 1097, y: 721, timestamp: 5401, cursorType: "default", type: "move" },
	{ x: 1123, y: 718, timestamp: 5401, cursorType: "default", type: "move" },
	{ x: 1159, y: 702, timestamp: 5404, cursorType: "default", type: "move" },
	{ x: 1195, y: 685, timestamp: 5411, cursorType: "default", type: "move" },
	{ x: 1211, y: 674, timestamp: 5418, cursorType: "default", type: "move" },
	{ x: 1241, y: 654, timestamp: 5424, cursorType: "default", type: "move" },
	{ x: 1265, y: 633, timestamp: 5432, cursorType: "default", type: "move" },
	{ x: 1281, y: 613, timestamp: 5441, cursorType: "default", type: "move" },
	{ x: 1294, y: 589, timestamp: 5454, cursorType: "default", type: "move" },
	{ x: 1302, y: 569, timestamp: 5460, cursorType: "default", type: "move" },
	{ x: 1303, y: 547, timestamp: 5500, cursorType: "default", type: "move" },
	{ x: 1303, y: 511, timestamp: 5502, cursorType: "default", type: "move" },
	{ x: 1300, y: 502, timestamp: 5506, cursorType: "default", type: "move" },
	{ x: 1285, y: 485, timestamp: 5508, cursorType: "default", type: "move" },
	{ x: 1255, y: 464, timestamp: 5511, cursorType: "default", type: "move" },
	{ x: 1229, y: 463, timestamp: 5511, cursorType: "default", type: "move" },
	{ x: 1193, y: 463, timestamp: 5513, cursorType: "default", type: "move" },
	{ x: 1130, y: 487, timestamp: 5520, cursorType: "default", type: "move" },
	{ x: 1107, y: 510, timestamp: 5528, cursorType: "default", type: "move" },
	{ x: 1070, y: 552, timestamp: 5565, cursorType: "default", type: "move" },
	{ x: 1037, y: 597, timestamp: 5567, cursorType: "default", type: "move" },
	{ x: 1029, y: 615, timestamp: 5568, cursorType: "default", type: "move" },
	{ x: 1016, y: 647, timestamp: 5568, cursorType: "default", type: "move" },
	{ x: 1016, y: 657, timestamp: 5569, cursorType: "default", type: "move" },
	{ x: 1011, y: 697, timestamp: 5576, cursorType: "default", type: "move" },
	{ x: 1011, y: 709, timestamp: 5585, cursorType: "default", type: "move" },
	{ x: 1020, y: 717, timestamp: 5592, cursorType: "default", type: "move" },
	{ x: 1043, y: 726, timestamp: 5625, cursorType: "default", type: "move" },
	{ x: 1071, y: 726, timestamp: 5625, cursorType: "default", type: "move" },
	{ x: 1108, y: 726, timestamp: 5625, cursorType: "default", type: "move" },
	{ x: 1143, y: 713, timestamp: 5631, cursorType: "default", type: "move" },
	{ x: 1160, y: 704, timestamp: 5633, cursorType: "default", type: "move" },
	{ x: 1188, y: 689, timestamp: 5646, cursorType: "default", type: "move" },
	{ x: 1211, y: 671, timestamp: 5650, cursorType: "default", type: "move" },
	{ x: 1227, y: 654, timestamp: 5657, cursorType: "default", type: "move" },
	{ x: 1238, y: 635, timestamp: 5668, cursorType: "default", type: "move" },
	{ x: 1244, y: 613, timestamp: 5672, cursorType: "default", type: "move" },
	{ x: 1247, y: 577, timestamp: 5681, cursorType: "default", type: "move" },
	{ x: 1247, y: 551, timestamp: 5688, cursorType: "default", type: "move" },
	{ x: 1240, y: 541, timestamp: 5715, cursorType: "default", type: "move" },
	{ x: 1215, y: 509, timestamp: 5723, cursorType: "default", type: "move" },
	{ x: 1191, y: 499, timestamp: 5735, cursorType: "default", type: "move" },
	{ x: 1162, y: 498, timestamp: 5735, cursorType: "default", type: "move" },
	{ x: 1128, y: 498, timestamp: 5735, cursorType: "default", type: "move" },
	{ x: 1064, y: 531, timestamp: 5737, cursorType: "default", type: "move" },
	{ x: 1025, y: 571, timestamp: 5746, cursorType: "default", type: "move" },
	{ x: 1010, y: 600, timestamp: 5755, cursorType: "default", type: "move" },
	{ x: 985, y: 646, timestamp: 5761, cursorType: "default", type: "move" },
	{ x: 979, y: 668, timestamp: 5769, cursorType: "default", type: "move" },
	{ x: 970, y: 704, timestamp: 5779, cursorType: "default", type: "move" },
	{ x: 970, y: 716, timestamp: 5786, cursorType: "default", type: "move" },
	{ x: 970, y: 762, timestamp: 5802, cursorType: "default", type: "move" },
	{ x: 971, y: 775, timestamp: 5836, cursorType: "default", type: "move" },
	{ x: 982, y: 784, timestamp: 5836, cursorType: "default", type: "move" },
	{ x: 1012, y: 794, timestamp: 5836, cursorType: "default", type: "move" },
	{ x: 1040, y: 794, timestamp: 5836, cursorType: "default", type: "move" },
	{ x: 1077, y: 785, timestamp: 5836, cursorType: "default", type: "move" },
	{ x: 1116, y: 767, timestamp: 5849, cursorType: "default", type: "move" },
	{ x: 1161, y: 740, timestamp: 5850, cursorType: "default", type: "move" },
	{ x: 1177, y: 727, timestamp: 5857, cursorType: "default", type: "move" },
	{ x: 1204, y: 702, timestamp: 5865, cursorType: "default", type: "move" },
	{ x: 1225, y: 678, timestamp: 5873, cursorType: "default", type: "move" },
	{ x: 1237, y: 651, timestamp: 5895, cursorType: "default", type: "move" },
	{ x: 1244, y: 625, timestamp: 5896, cursorType: "default", type: "move" },
	{ x: 1245, y: 579, timestamp: 5902, cursorType: "default", type: "move" },
	{ x: 1244, y: 553, timestamp: 5907, cursorType: "default", type: "move" },
	{ x: 1229, y: 531, timestamp: 5913, cursorType: "default", type: "move" },
	{ x: 1217, y: 524, timestamp: 5921, cursorType: "default", type: "move" },
	{ x: 1181, y: 506, timestamp: 5939, cursorType: "default", type: "move" },
	{ x: 1153, y: 506, timestamp: 5941, cursorType: "default", type: "move" },
	{ x: 1122, y: 508, timestamp: 5945, cursorType: "default", type: "move" },
	{ x: 1089, y: 532, timestamp: 5953, cursorType: "default", type: "move" },
	{ x: 1059, y: 563, timestamp: 5962, cursorType: "default", type: "move" },
	{ x: 1051, y: 578, timestamp: 5969, cursorType: "default", type: "move" },
	{ x: 1046, y: 590, timestamp: 5980, cursorType: "default", type: "move" },
	{ x: 1037, y: 612, timestamp: 5989, cursorType: "default", type: "move" },
	{ x: 1034, y: 632, timestamp: 5993, cursorType: "default", type: "move" },
	{ x: 1034, y: 645, timestamp: 6011, cursorType: "default", type: "move" },
	{ x: 1034, y: 654, timestamp: 6012, cursorType: "default", type: "move" },
	{ x: 1042, y: 666, timestamp: 6017, cursorType: "default", type: "move" },
	{ x: 1052, y: 669, timestamp: 6067, cursorType: "default", type: "move" },
	{ x: 1066, y: 670, timestamp: 6069, cursorType: "default", type: "move" },
	{ x: 1079, y: 670, timestamp: 6076, cursorType: "default", type: "move" },
	{ x: 1086, y: 670, timestamp: 6076, cursorType: "default", type: "move" },
	{ x: 1086, y: 670, timestamp: 6563, cursorType: "default", type: "move" },
	{ x: 1091, y: 669, timestamp: 6570, cursorType: "default", type: "move" },
	{ x: 1099, y: 666, timestamp: 6578, cursorType: "default", type: "move" },
	{ x: 1116, y: 660, timestamp: 6587, cursorType: "default", type: "move" },
	{ x: 1142, y: 653, timestamp: 6595, cursorType: "default", type: "move" },
	{ x: 1176, y: 644, timestamp: 6603, cursorType: "default", type: "move" },
	{ x: 1218, y: 637, timestamp: 6613, cursorType: "default", type: "move" },
	{ x: 1264, y: 631, timestamp: 6619, cursorType: "default", type: "move" },
	{ x: 1312, y: 627, timestamp: 6627, cursorType: "default", type: "move" },
	{ x: 1332, y: 627, timestamp: 6635, cursorType: "default", type: "move" },
	{ x: 1371, y: 626, timestamp: 6643, cursorType: "default", type: "move" },
	{ x: 1383, y: 626, timestamp: 6652, cursorType: "default", type: "move" },
	{ x: 1391, y: 626, timestamp: 6659, cursorType: "default", type: "move" },
	{ x: 1408, y: 626, timestamp: 6667, cursorType: "default", type: "move" },
	{ x: 1418, y: 625, timestamp: 6682, cursorType: "default", type: "move" },
	{ x: 1425, y: 624, timestamp: 6684, cursorType: "default", type: "move" },
	{ x: 1425, y: 624, timestamp: 6976, cursorType: "default", type: "move" },
	{ x: 1425, y: 619, timestamp: 6980, cursorType: "default", type: "move" },
	{ x: 1423, y: 614, timestamp: 6989, cursorType: "default", type: "move" },
	{ x: 1422, y: 608, timestamp: 6996, cursorType: "default", type: "move" },
	{ x: 1420, y: 599, timestamp: 7007, cursorType: "default", type: "move" },
	{ x: 1415, y: 578, timestamp: 7012, cursorType: "default", type: "move" },
	{ x: 1411, y: 552, timestamp: 7020, cursorType: "default", type: "move" },
	{ x: 1406, y: 518, timestamp: 7028, cursorType: "default", type: "move" },
	{ x: 1403, y: 478, timestamp: 7041, cursorType: "default", type: "move" },
	{ x: 1400, y: 436, timestamp: 7054, cursorType: "default", type: "move" },
	{ x: 1400, y: 417, timestamp: 7055, cursorType: "default", type: "move" },
	{ x: 1399, y: 380, timestamp: 7076, cursorType: "default", type: "move" },
	{ x: 1399, y: 347, timestamp: 7077, cursorType: "default", type: "move" },
	{ x: 1399, y: 336, timestamp: 7078, cursorType: "default", type: "move" },
	{ x: 1399, y: 329, timestamp: 7084, cursorType: "default", type: "move" },
	{ x: 1399, y: 313, timestamp: 7095, cursorType: "default", type: "move" },
	{ x: 1399, y: 303, timestamp: 7100, cursorType: "default", type: "move" },
	{ x: 1399, y: 302, timestamp: 7389, cursorType: "default", type: "move" },
	{ x: 1399, y: 294, timestamp: 7407, cursorType: "default", type: "move" },
	{ x: 1399, y: 284, timestamp: 7409, cursorType: "default", type: "move" },
	{ x: 1399, y: 272, timestamp: 7413, cursorType: "default", type: "move" },
	{ x: 1399, y: 258, timestamp: 7421, cursorType: "default", type: "move" },
	{ x: 1399, y: 243, timestamp: 7429, cursorType: "default", type: "move" },
	{ x: 1399, y: 209, timestamp: 7436, cursorType: "default", type: "move" },
	{ x: 1400, y: 194, timestamp: 7446, cursorType: "default", type: "move" },
	{ x: 1401, y: 160, timestamp: 7453, cursorType: "default", type: "move" },
	{ x: 1402, y: 129, timestamp: 7461, cursorType: "default", type: "move" },
	{ x: 1404, y: 103, timestamp: 7468, cursorType: "default", type: "move" },
	{ x: 1405, y: 93, timestamp: 7479, cursorType: "default", type: "move" },
	{ x: 1406, y: 73, timestamp: 7487, cursorType: "default", type: "move" },
	{ x: 1407, y: 58, timestamp: 7494, cursorType: "default", type: "move" },
	{ x: 1407, y: 53, timestamp: 7506, cursorType: "default", type: "move" },
	{ x: 1408, y: 44, timestamp: 7511, cursorType: "default", type: "move" },
	{ x: 1409, y: 38, timestamp: 7518, cursorType: "default", type: "move" },
	{ x: 1409, y: 33, timestamp: 7531, cursorType: "default", type: "move" },
	{ x: 1410, y: 31, timestamp: 7533, cursorType: "default", type: "move" },
	{ x: 1410, y: 29, timestamp: 7546, cursorType: "default", type: "move" },
	{ x: 1410, y: 29, timestamp: 7549, cursorType: "default", type: "move" },
	{ x: 1411, y: 28, timestamp: 7557, cursorType: "default", type: "move" },
	{ x: 1411, y: 28, timestamp: 7565, cursorType: "default", type: "move" },
	{ x: 1411, y: 27, timestamp: 7588, cursorType: "default", type: "move" },
	{ x: 1410, y: 27, timestamp: 7766, cursorType: "default", type: "move" },
	{ x: 1410, y: 27, timestamp: 7783, cursorType: "default", type: "move" },
	{ x: 1410, y: 27, timestamp: 7789, cursorType: "default", type: "move" },
	{ x: 1409, y: 27, timestamp: 7799, cursorType: "default", type: "move" },
	{ x: 1408, y: 27, timestamp: 7812, cursorType: "default", type: "move" },
	{ x: 1407, y: 27, timestamp: 7813, cursorType: "default", type: "move" },
	{ x: 1407, y: 27, timestamp: 7821, cursorType: "default", type: "move" },
	{ x: 1406, y: 27, timestamp: 7842, cursorType: "default", type: "move" },
	{ x: 1405, y: 28, timestamp: 7846, cursorType: "default", type: "move" },
	{ x: 1404, y: 28, timestamp: 7852, cursorType: "default", type: "move" },
	{ x: 1403, y: 28, timestamp: 7854, cursorType: "default", type: "move" },
	{ x: 1402, y: 28, timestamp: 7864, cursorType: "default", type: "move" },
	{ x: 1402, y: 28, timestamp: 7870, cursorType: "default", type: "move" },
	{ x: 1401, y: 28, timestamp: 7877, cursorType: "default", type: "move" },
	{ x: 1401, y: 28, timestamp: 7886, cursorType: "default", type: "move" },
	{ x: 1400, y: 28, timestamp: 7895, cursorType: "default", type: "move" },
	{ x: 1400, y: 28, timestamp: 7902, cursorType: "default", type: "move" },
	{ x: 1400, y: 28, timestamp: 8235, cursorType: "default", type: "move" },
	{
		x: 1400,
		y: 28,
		timestamp: 8235,
		cursorType: "pointer",
		type: "mousedown",
		button: 1,
		clickCount: 1,
	},
	{
		x: 1400,
		y: 28,
		timestamp: 8235,
		cursorType: "default",
		type: "mouseup",
		button: 1,
	},
	{ x: 1400, y: 28, timestamp: 8235, cursorType: "default", type: "move" },
	{ x: 1400, y: 29, timestamp: 8235, cursorType: "default", type: "move" },
	{ x: 1400, y: 31, timestamp: 8235, cursorType: "default", type: "move" },
	{ x: 1400, y: 34, timestamp: 8235, cursorType: "default", type: "move" },
	{ x: 1400, y: 37, timestamp: 8235, cursorType: "default", type: "move" },
	{ x: 1400, y: 40, timestamp: 8235, cursorType: "default", type: "move" },
	{ x: 1400, y: 42, timestamp: 8235, cursorType: "default", type: "move" },
	{ x: 1400, y: 45, timestamp: 8235, cursorType: "default", type: "move" },
	{ x: 1400, y: 47, timestamp: 8235, cursorType: "default", type: "move" },
	{ x: 1400, y: 48, timestamp: 8235, cursorType: "default", type: "move" },
	{ x: 1400, y: 50, timestamp: 8235, cursorType: "default", type: "move" },
	{ x: 1400, y: 51, timestamp: 8235, cursorType: "default", type: "move" },
	{ x: 1400, y: 51, timestamp: 8235, cursorType: "default", type: "move" },
	{ x: 1400, y: 52, timestamp: 8235, cursorType: "default", type: "move" },
	{ x: 1400, y: 53, timestamp: 8235, cursorType: "default", type: "move" },
	{ x: 1400, y: 53, timestamp: 8235, cursorType: "default", type: "move" },
	{ x: 1400, y: 53, timestamp: 8277, cursorType: "default", type: "move" },
	{ x: 1400, y: 53, timestamp: 8281, cursorType: "default", type: "move" },
	{ x: 1400, y: 54, timestamp: 8281, cursorType: "default", type: "move" },
	{ x: 1400, y: 54, timestamp: 8284, cursorType: "default", type: "move" },
	{ x: 1400, y: 54, timestamp: 8285, cursorType: "default", type: "move" },
	{ x: 1400, y: 54, timestamp: 8286, cursorType: "default", type: "move" },
	{ x: 1400, y: 28, timestamp: 8335, cursorType: "default", type: "scale" },
	{ x: 1400, y: 55, timestamp: 8387, cursorType: "default", type: "move" },
	{ x: 1400, y: 55, timestamp: 8397, cursorType: "default", type: "move" },
	{ x: 1400, y: 55, timestamp: 8404, cursorType: "default", type: "move" },
	{ x: 1400, y: 56, timestamp: 8404, cursorType: "default", type: "move" },
	{ x: 1400, y: 56, timestamp: 8404, cursorType: "default", type: "move" },
	{ x: 1400, y: 57, timestamp: 8404, cursorType: "default", type: "move" },
	{ x: 1400, y: 57, timestamp: 8404, cursorType: "default", type: "move" },
	{ x: 1400, y: 58, timestamp: 8404, cursorType: "default", type: "move" },
	{ x: 1400, y: 58, timestamp: 8404, cursorType: "default", type: "move" },
	{ x: 1400, y: 58, timestamp: 8405, cursorType: "default", type: "move" },
	{ x: 1400, y: 59, timestamp: 8405, cursorType: "default", type: "move" },
	{ x: 1400, y: 28, timestamp: 8435, cursorType: "default", type: "scale" },
	{
		x: 1400,
		y: 59,
		timestamp: 8654,
		cursorType: "pointer",
		type: "mousedown",
		button: 1,
		clickCount: 1,
	},
	{
		x: 1400,
		y: 59,
		timestamp: 8728,
		cursorType: "default",
		type: "mouseup",
		button: 1,
	},
	{ x: 1400, y: 59, timestamp: 8754, cursorType: "default", type: "scale" },
	{ x: 1400, y: 59, timestamp: 8854, cursorType: "default", type: "scale" },
];

let index = 0;
const speed = 0.1;

function playCursorData() {
	if (index >= cursorData.length) {
		index = 0; // Loop
	}

	const point = cursorData[index];

	targetX = point.x;
	targetY = point.y;

	// Tıklama efektini uygula
	if (point.type === "mousedown") {
		targetScale = 0.8;
	} else if (point.type === "mouseup") {
		targetScale = 1;
	}

	index++;

	setTimeout(playCursorData, 16);
}

function animate() {
	ctx.clearRect(0, 0, width, height);

	const prevX = cursorX;
	const prevY = cursorY;

	// Calculate distance to target for adaptive smoothing
	const distance = Math.sqrt(
		Math.pow(targetX - cursorX, 2) + Math.pow(targetY - cursorY, 2)
	);

	// Apply different smoothing based on distance
	let currentSpeed = speed;
	if (distance < 5) {
		currentSpeed = speed * 2; // Faster for small movements (more precise)
	} else if (distance > 100) {
		currentSpeed = speed * 0.8; // Slower for large jumps (more fluid)
	}

	cursorX += (targetX - cursorX) * currentSpeed;
	cursorY += (targetY - cursorY) * currentSpeed;

	const dx = cursorX - prevX;
	const dy = cursorY - prevY;

	// Calculate movement speed for blur effect
	const moveSpeed = Math.sqrt(dx * dx + dy * dy);

	// Eğimi ve warp değerlerini hız ve yönlere göre ayarla
	const maxRotation = 0.02;
	targetRotation = dx * maxRotation;

	// Daha belirgin warp efekti
	const maxWarp = 0.045; // Increased for more visible warp effect
	const speedFactor = Math.min(moveSpeed / 20, 1); // Speed-based scaling for warp effect
	const dynamicWarpX =
		1 + Math.min(Math.abs(dx) * maxWarp * (1 + speedFactor * 0.5), 0.065);
	const dynamicWarpY =
		1 - Math.min(Math.abs(dy) * maxWarp * (1 + speedFactor * 0.5), 0.065);

	targetWarpX = dynamicWarpX;
	targetWarpY = dynamicWarpY;

	// Smooth geçişler
	rotation += (targetRotation - rotation) * 0.1;
	warpX += (targetWarpX - warpX) * 0.1;
	warpY += (targetWarpY - warpY) * 0.1;
	currentScale += (targetScale - currentScale) * 0.2;

	// Apply blur based on movement speed - slightly reduced blur to emphasize warp
	const blurAmount = Math.min(moveSpeed * 0.4, 1.5);
	ctx.filter = moveSpeed > 3 ? `blur(${blurAmount}px)` : "none";

	ctx.save();
	ctx.translate(cursorX, cursorY);
	ctx.rotate(rotation);
	ctx.scale(currentScale * warpX, currentScale * warpY);

	ctx.drawImage(img, -cursorSize / 2, -cursorSize / 2, cursorSize, cursorSize);

	ctx.restore();

	ctx.filter = "none";

	requestAnimationFrame(animate);
}

img.onload = () => {
	playCursorData();
	animate();
};
