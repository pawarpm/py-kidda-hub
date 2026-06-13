export const categories = {
  'Basic Python': [
    'Interpreter and Execution Models',
    'Data Types and Variables',
    'Control Structures',
    'Loops and Functions',
    'Exception Handling',
    'String Handling',
    'Variable Scope'
  ],
  'Intermediate Python': [
    'OOP Classes and Objects',
    'Constructors and Methods',
    'Class and Instance Variables',
    'Inheritance',
    'Polymorphism',
    'Modules and Packages',
    'CSV Files',
    'Logging'
  ],
  'Advanced Python': [
    'Datetime and Calendar',
    'Random and Math Modules',
    'Numerical Arrays',
    'Pandas Style Data Handling',
    'Data Preprocessing',
    'Outlier Handling',
    'Encoding',
    'Data Exploration'
  ]
} as const;

type QuestionSeed = {
  title: string;
  slug: string;
  category: keyof typeof categories;
  topic: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  statement: string;
  constraints: string;
  sampleInput: string;
  sampleOutput: string;
  starterCode: string;
  points: number;
  cases: Array<{ input: string; output: string; hidden: boolean; weight?: number }>;
};

type Spec = Omit<QuestionSeed, 'slug' | 'points'>;

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function withDefaults(spec: Spec, index: number): QuestionSeed {
  return {
    ...spec,
    slug: `${slugify(spec.title)}-${index + 1}`,
    points: spec.difficulty === 'Easy' ? 10 : spec.difficulty === 'Medium' ? 20 : 30,
    cases: spec.cases.map((testCase, caseIndex) => ({
      ...testCase,
      hidden: testCase.hidden ?? caseIndex > 0,
      weight: testCase.weight || 1
    }))
  };
}

const syllabusSpecs: Spec[] = [
  {
    title: 'Prime Number with Invalid Input Handling',
    category: 'Basic Python',
    topic: 'Interpreter and Execution Models',
    difficulty: 'Easy',
    statement:
      'Unit 1 asks students to design a Python program that takes an integer, checks whether it is prime, and handles invalid input using exception handling.\n\nRead one value. Print PRIME, NOT PRIME, or INVALID.',
    constraints: 'Input may be an integer or a non-integer token. Treat numbers less than 2 as NOT PRIME.',
    sampleInput: '17\n',
    sampleOutput: 'PRIME',
    starterCode: "value = input().strip()\n# print PRIME, NOT PRIME, or INVALID\n",
    cases: [
      { input: '17\n', output: 'PRIME', hidden: false },
      { input: '1\n', output: 'NOT PRIME', hidden: true },
      { input: 'abc\n', output: 'INVALID', hidden: true },
      { input: '49\n', output: 'NOT PRIME', hidden: true }
    ]
  },
  {
    title: 'Script Mode Message Formatter',
    category: 'Basic Python',
    topic: 'Interpreter and Execution Models',
    difficulty: 'Easy',
    statement:
      'Unit 1 includes writing a script that accepts a filename and a message. In this sandbox version, read a filename and message, then print the line that would be stored in that file.\n\nOutput format: Saved to <filename>: <message>',
    constraints: 'Filename has no spaces. Message may contain spaces.',
    sampleInput: 'note.txt\nPython is easy\n',
    sampleOutput: 'Saved to note.txt: Python is easy',
    starterCode: "filename = input().strip()\nmessage = input().strip()\n# print formatted save message\n",
    cases: [
      { input: 'note.txt\nPython is easy\n', output: 'Saved to note.txt: Python is easy', hidden: false },
      { input: 'lab.txt\nHello SY students\n', output: 'Saved to lab.txt: Hello SY students', hidden: true },
      { input: 'out.md\nPractice daily\n', output: 'Saved to out.md: Practice daily', hidden: true }
    ]
  },
  {
    title: 'Dynamic Typing Type Reporter',
    category: 'Basic Python',
    topic: 'Data Types and Variables',
    difficulty: 'Easy',
    statement:
      'Based on Unit 2 dynamic typing. Read three values and print their inferred simple type: int, float, bool, or str. Print one type per line.',
    constraints: 'Boolean values are exactly True or False. Integers and floats are in valid Python numeric notation.',
    sampleInput: '10\n3.5\nhello\n',
    sampleOutput: 'int\nfloat\nstr',
    starterCode: "values = [input().strip() for _ in range(3)]\n# print inferred type for each value\n",
    cases: [
      { input: '10\n3.5\nhello\n', output: 'int\nfloat\nstr', hidden: false },
      { input: 'False\n-7\n2.0\n', output: 'bool\nint\nfloat', hidden: true },
      { input: 'abc123\nTrue\n0\n', output: 'str\nbool\nint', hidden: true }
    ]
  },
  {
    title: 'Sum Only Integers from Mixed List',
    category: 'Basic Python',
    topic: 'Exception Handling',
    difficulty: 'Easy',
    statement:
      'Unit 2 asks for a function that receives a mixed list of integers and strings and uses try-except to calculate only the sum of integers.\n\nRead n and then n space-separated tokens. Convert tokens that are integers and ignore the rest. Print the sum.',
    constraints: '0 <= n <= 100. Tokens do not contain spaces.',
    sampleInput: '6\n10 apple 20 b 5 3\n',
    sampleOutput: '38',
    starterCode: "n = int(input())\ntokens = input().split() if n else []\n# sum integer tokens only\n",
    cases: [
      { input: '6\n10 apple 20 b 5 3\n', output: '38', hidden: false },
      { input: '4\nx y z 9\n', output: '9', hidden: true },
      { input: '0\n', output: '0', hidden: true },
      { input: '5\n-2 4.5 8 nope -3\n', output: '3', hidden: true }
    ]
  },
  {
    title: 'Vowels in Each Word Dictionary',
    category: 'Basic Python',
    topic: 'String Handling',
    difficulty: 'Medium',
    statement:
      'Unit 2 asks for a function that returns a dictionary containing each word as a key and the number of vowels in that word as its value.\n\nRead a sentence. Print each unique word in first-appearance order as: word count',
    constraints: 'Words are separated by spaces. Vowels are a, e, i, o, u in either case.',
    sampleInput: 'Python is amazing\n',
    sampleOutput: 'Python 1\nis 1\namazing 3',
    starterCode: "sentence = input().strip()\n# print each unique word and its vowel count\n",
    cases: [
      { input: 'Python is amazing\n', output: 'Python 1\nis 1\namazing 3', hidden: false },
      { input: 'hello world hello\n', output: 'hello 2\nworld 1', hidden: true },
      { input: 'AEIOU rhythm\n', output: 'AEIOU 5\nrhythm 0', hidden: true }
    ]
  },
  {
    title: 'Identifier Email or URL Validator',
    category: 'Basic Python',
    topic: 'Control Structures',
    difficulty: 'Medium',
    statement:
      'Unit 2 asks students to check whether a string is a valid identifier, email ID, or URL using control structures and string validation.\n\nRead one string and print IDENTIFIER, EMAIL, URL, or INVALID.',
    constraints: 'A URL starts with http:// or https://. A simple email has one @ and a dot after @.',
    sampleInput: 'student@sveri.ac.in\n',
    sampleOutput: 'EMAIL',
    starterCode: "s = input().strip()\n# classify the string\n",
    cases: [
      { input: 'student@sveri.ac.in\n', output: 'EMAIL', hidden: false },
      { input: 'total_marks\n', output: 'IDENTIFIER', hidden: true },
      { input: 'https://python.org\n', output: 'URL', hidden: true },
      { input: '2marks\n', output: 'INVALID', hidden: true }
    ]
  },
  {
    title: 'Character Type Counter',
    category: 'Basic Python',
    topic: 'String Handling',
    difficulty: 'Medium',
    statement:
      'Unit 2 asks for a function that counts digits, alphabets, whitespaces, and special characters in a string.\n\nRead a full line and print counts in this order: digits alphabets whitespaces special',
    constraints: 'Input is a single line of text.',
    sampleInput: 'Abc 123 @#\n',
    sampleOutput: '3 3 2 2',
    starterCode: "s = input()\n# print: digits alphabets whitespaces special\n",
    cases: [
      { input: 'Abc 123 @#\n', output: '3 3 2 2', hidden: false },
      { input: 'PY Kidda Hub 2026!\n', output: '4 10 3 1', hidden: true },
      { input: 'NoSpecial\n', output: '0 9 0 0', hidden: true }
    ]
  },
  {
    title: 'Prime Numbers from a List',
    category: 'Basic Python',
    topic: 'Loops and Functions',
    difficulty: 'Medium',
    statement:
      'Unit 2 asks for a function that accepts a list and returns a new list with only prime numbers, handling non-integer elements.\n\nRead n and n tokens. Print prime integers separated by spaces. If none exist, print NONE.',
    constraints: '0 <= n <= 100. Ignore non-integer tokens.',
    sampleInput: '8\n2 4 5 a 9 11 1 13\n',
    sampleOutput: '2 5 11 13',
    starterCode: "n = int(input())\ntokens = input().split() if n else []\n# print prime integer tokens\n",
    cases: [
      { input: '8\n2 4 5 a 9 11 1 13\n', output: '2 5 11 13', hidden: false },
      { input: '4\n0 1 x 4\n', output: 'NONE', hidden: true },
      { input: '5\n17 -3 19 20 z\n', output: '17 19', hidden: true }
    ]
  },
  {
    title: 'Simple Calculator with Exceptions',
    category: 'Basic Python',
    topic: 'Exception Handling',
    difficulty: 'Medium',
    statement:
      'Unit 2 asks for a simple calculator using if-elif-else and exception handling.\n\nRead two numbers and an operator (+, -, *, /). Print the result. For division by zero print DIVISION BY ZERO. For invalid operator print INVALID OPERATOR.',
    constraints: 'Inputs are provided as: number1 number2 operator. Print integers without .0 when possible.',
    sampleInput: '10 5 /\n',
    sampleOutput: '2',
    starterCode: "a, b, op = input().split()\n# calculate and print result\n",
    cases: [
      { input: '10 5 /\n', output: '2', hidden: false },
      { input: '7 3 +\n', output: '10', hidden: true },
      { input: '9 0 /\n', output: 'DIVISION BY ZERO', hidden: true },
      { input: '4 2 %\n', output: 'INVALID OPERATOR', hidden: true }
    ]
  },
  {
    title: 'Word Count Dictionary',
    category: 'Basic Python',
    topic: 'Variable Scope',
    difficulty: 'Medium',
    statement:
      'Unit 2 asks for a word-count function using string methods and a demonstration of local/global variables.\n\nRead a sentence. Ignore case and punctuation .,!? Print words in alphabetical order as: word count',
    constraints: 'Sentence is one line.',
    sampleInput: 'Python, python is fun!\n',
    sampleOutput: 'fun 1\nis 1\npython 2',
    starterCode: "sentence = input().strip()\n# clean, count, and print words alphabetically\n",
    cases: [
      { input: 'Python, python is fun!\n', output: 'fun 1\nis 1\npython 2', hidden: false },
      { input: 'to be or not to be\n', output: 'be 2\nnot 1\nor 1\nto 2', hidden: true },
      { input: 'Hello? HELLO, hello.\n', output: 'hello 3', hidden: true }
    ]
  },
  {
    title: 'String Operations and Palindrome',
    category: 'Basic Python',
    topic: 'String Handling',
    difficulty: 'Easy',
    statement:
      'Unit 2 asks for uppercase conversion, vowel count, and palindrome checking.\n\nRead a string. Print uppercase string, vowel count, and YES/NO for palindrome on separate lines.',
    constraints: 'Ignore spaces and case for palindrome checking.',
    sampleInput: 'Madam\n',
    sampleOutput: 'MADAM\n2\nYES',
    starterCode: "s = input().strip()\n# uppercase, vowel count, palindrome result\n",
    cases: [
      { input: 'Madam\n', output: 'MADAM\n2\nYES', hidden: false },
      { input: 'Python Lab\n', output: 'PYTHON LAB\n2\nNO', hidden: true },
      { input: 'Never Odd Or Even\n', output: 'NEVER ODD OR EVEN\n6\nYES', hidden: true }
    ]
  },
  {
    title: 'Number Report Even Factorial Prime',
    category: 'Basic Python',
    topic: 'Loops and Functions',
    difficulty: 'Medium',
    statement:
      'Unit 2 asks for a program that checks even/odd, computes factorial using a loop, and checks prime using a function.\n\nRead n. Print EVEN or ODD, factorial, and PRIME or NOT PRIME on separate lines.',
    constraints: '0 <= n <= 12.',
    sampleInput: '5\n',
    sampleOutput: 'ODD\n120\nPRIME',
    starterCode: "n = int(input())\n# print even/odd, factorial, and prime status\n",
    cases: [
      { input: '5\n', output: 'ODD\n120\nPRIME', hidden: false },
      { input: '4\n', output: 'EVEN\n24\nNOT PRIME', hidden: true },
      { input: '0\n', output: 'EVEN\n1\nNOT PRIME', hidden: true }
    ]
  },
  {
    title: 'Student Class Display',
    category: 'Intermediate Python',
    topic: 'OOP Classes and Objects',
    difficulty: 'Medium',
    statement:
      'Unit 3 asks for a Student class that stores name, roll number, and marks, then displays details.\n\nRead n, then n lines containing name roll marks. Use a class and print: roll name marks',
    constraints: '1 <= n <= 10. Name has no spaces.',
    sampleInput: '2\nAsha 1 86\nRavi 2 74\n',
    sampleOutput: '1 Asha 86\n2 Ravi 74',
    starterCode: "class Student:\n    pass\n\nn = int(input())\n# create objects and display details\n",
    cases: [
      { input: '2\nAsha 1 86\nRavi 2 74\n', output: '1 Asha 86\n2 Ravi 74', hidden: false },
      { input: '1\nSita 9 91\n', output: '9 Sita 91', hidden: true },
      { input: '3\nA 1 10\nB 2 20\nC 3 30\n', output: '1 A 10\n2 B 20\n3 C 30', hidden: true }
    ]
  },
  {
    title: 'Circle Class Area',
    category: 'Intermediate Python',
    topic: 'OOP Classes and Objects',
    difficulty: 'Easy',
    statement:
      'Unit 3 asks for a Circle class with radius and area() method.\n\nRead radius and print area rounded to 2 decimal places. Use pi = 3.14159.',
    constraints: '0 < radius <= 1000.',
    sampleInput: '7\n',
    sampleOutput: '153.94',
    starterCode: "class Circle:\n    pass\n\nr = float(input())\n# print area rounded to 2 decimals\n",
    cases: [
      { input: '7\n', output: '153.94', hidden: false },
      { input: '1\n', output: '3.14', hidden: true },
      { input: '2.5\n', output: '19.63', hidden: true }
    ]
  },
  {
    title: 'Employee Class Raise',
    category: 'Intermediate Python',
    topic: 'Class and Instance Variables',
    difficulty: 'Medium',
    statement:
      'Unit 3 asks for an Employee class with class variable company_name, instance variables, display method, and raise operation.\n\nRead company name, employee count, then emp_id emp_name salary. Read raise percentage. Print emp_id emp_name updated_salary for each employee.',
    constraints: 'Salary and raise percentage are integers.',
    sampleInput: 'PKH\n2\n1 Anu 50000\n2 Om 60000\n10\n',
    sampleOutput: '1 Anu 55000\n2 Om 66000',
    starterCode: "class Employee:\n    company_name = ''\n\n# read employees, apply raise, print updated data\n",
    cases: [
      { input: 'PKH\n2\n1 Anu 50000\n2 Om 60000\n10\n', output: '1 Anu 55000\n2 Om 66000', hidden: false },
      { input: 'ABC\n1\n7 Riya 40000\n5\n', output: '7 Riya 42000', hidden: true },
      { input: 'Demo\n2\n3 A 100\n4 B 250\n20\n', output: '3 A 120\n4 B 300', hidden: true }
    ]
  },
  {
    title: 'Animal Sound Polymorphism',
    category: 'Intermediate Python',
    topic: 'Polymorphism',
    difficulty: 'Easy',
    statement:
      'Unit 3 asks for Animal sound() with Dog and Cat overriding the method.\n\nRead n animal names. For each Dog print Bark, for Cat print Meow, otherwise print Unknown.',
    constraints: 'Animal names are case-sensitive: Dog, Cat.',
    sampleInput: '3\nDog Cat Cow\n',
    sampleOutput: 'Bark\nMeow\nUnknown',
    starterCode: "class Animal:\n    def sound(self):\n        return 'Unknown'\n\n# create subclasses and print sounds\n",
    cases: [
      { input: '3\nDog Cat Cow\n', output: 'Bark\nMeow\nUnknown', hidden: false },
      { input: '2\nCat Dog\n', output: 'Meow\nBark', hidden: true },
      { input: '1\nBird\n', output: 'Unknown', hidden: true }
    ]
  },
  {
    title: 'Bank Account Transactions',
    category: 'Intermediate Python',
    topic: 'Constructors and Methods',
    difficulty: 'Medium',
    statement:
      'Unit 3 asks for an Account class with deposit() and withdraw() methods.\n\nRead opening balance and number of transactions. Each transaction is D amount or W amount. Print final balance. If withdrawal is more than balance, ignore it.',
    constraints: '0 <= balance <= 100000. Amounts are integers.',
    sampleInput: '1000\n3\nD 500\nW 200\nW 2000\n',
    sampleOutput: '1300',
    starterCode: "class Account:\n    pass\n\n# process transactions and print final balance\n",
    cases: [
      { input: '1000\n3\nD 500\nW 200\nW 2000\n', output: '1300', hidden: false },
      { input: '0\n2\nD 100\nW 50\n', output: '50', hidden: true },
      { input: '500\n1\nW 700\n', output: '500', hidden: true }
    ]
  },
  {
    title: 'Rectangle and Cuboid Inheritance',
    category: 'Intermediate Python',
    topic: 'Inheritance',
    difficulty: 'Hard',
    statement:
      'Unit 3 asks for Rectangle methods and a derived Cuboid class that reuses rectangle logic.\n\nRead length, breadth, height. Print rectangle area, rectangle perimeter, cuboid surface area, and cuboid volume.',
    constraints: 'All dimensions are positive integers.',
    sampleInput: '2 3 4\n',
    sampleOutput: '6\n10\n52\n24',
    starterCode: "class Rectangle:\n    pass\n\nclass Cuboid(Rectangle):\n    pass\n\n# read dimensions and print required values\n",
    cases: [
      { input: '2 3 4\n', output: '6\n10\n52\n24', hidden: false },
      { input: '5 5 5\n', output: '25\n20\n150\n125', hidden: true },
      { input: '1 2 3\n', output: '2\n6\n22\n6', hidden: true }
    ]
  },
  {
    title: 'Datetime Days Remaining',
    category: 'Advanced Python',
    topic: 'Datetime and Calendar',
    difficulty: 'Medium',
    statement:
      'Unit 4 asks for a datetime program that calculates days remaining until a user-specified date.\n\nFor stable grading, read today and target date in YYYY-MM-DD format. Print the number of days from today to target.',
    constraints: 'Dates are valid ISO dates. Target may be before today.',
    sampleInput: '2026-06-13\n2026-06-20\n',
    sampleOutput: '7',
    starterCode: "from datetime import date\n# read today and target, print day difference\n",
    cases: [
      { input: '2026-06-13\n2026-06-20\n', output: '7', hidden: false },
      { input: '2025-01-01\n2025-12-31\n', output: '364', hidden: true },
      { input: '2026-06-13\n2026-06-10\n', output: '-3', hidden: true }
    ]
  },
  {
    title: 'Leap Years Between Years',
    category: 'Advanced Python',
    topic: 'Datetime and Calendar',
    difficulty: 'Easy',
    statement:
      'Unit 4 asks for listing leap years between 2000 and 2050 using calendar.\n\nRead start and end year. Print all leap years in the inclusive range separated by spaces.',
    constraints: '1900 <= start <= end <= 2100.',
    sampleInput: '2000 2020\n',
    sampleOutput: '2000 2004 2008 2012 2016 2020',
    starterCode: "import calendar\nstart, end = map(int, input().split())\n# print leap years\n",
    cases: [
      { input: '2000 2020\n', output: '2000 2004 2008 2012 2016 2020', hidden: false },
      { input: '2021 2023\n', output: 'NONE', hidden: true },
      { input: '1996 2004\n', output: '1996 2000 2004', hidden: true }
    ]
  },
  {
    title: 'All Mondays in a Month',
    category: 'Advanced Python',
    topic: 'Datetime and Calendar',
    difficulty: 'Medium',
    statement:
      'Unit 4 asks for displaying all Mondays of a specific month and year entered by the user.\n\nRead month and year. Print Monday dates as DD-MM-YYYY, one per line.',
    constraints: '1 <= month <= 12.',
    sampleInput: '7 2025\n',
    sampleOutput: '07-07-2025\n14-07-2025\n21-07-2025\n28-07-2025',
    starterCode: "import calendar\n# read month and year, print all Mondays\n",
    cases: [
      { input: '7 2025\n', output: '07-07-2025\n14-07-2025\n21-07-2025\n28-07-2025', hidden: false },
      { input: '2 2024\n', output: '05-02-2024\n12-02-2024\n19-02-2024\n26-02-2024', hidden: true },
      { input: '1 2026\n', output: '05-01-2026\n12-01-2026\n19-01-2026\n26-01-2026', hidden: true }
    ]
  },
  {
    title: 'Square Root Using Math Module',
    category: 'Advanced Python',
    topic: 'Random and Math Modules',
    difficulty: 'Easy',
    statement:
      'Unit 4 asks for using the math module to compute the square root of a user-entered number.\n\nRead a number and print its square root rounded to 2 decimal places.',
    constraints: 'Number is non-negative.',
    sampleInput: '49\n',
    sampleOutput: '7.00',
    starterCode: "import math\nx = float(input())\n# print square root rounded to 2 decimals\n",
    cases: [
      { input: '49\n', output: '7.00', hidden: false },
      { input: '2\n', output: '1.41', hidden: true },
      { input: '0\n', output: '0.00', hidden: true }
    ]
  },
  {
    title: 'Even Numbers Mean and Standard Deviation',
    category: 'Advanced Python',
    topic: 'Numerical Arrays',
    difficulty: 'Medium',
    statement:
      'Unit 4 asks for an array of the first 10 even numbers and determining mean and standard deviation. In this sandbox, solve it using core Python or any library you prefer.\n\nRead n and print the mean and population standard deviation of the first n positive even numbers rounded to 2 decimals.',
    constraints: '1 <= n <= 100.',
    sampleInput: '10\n',
    sampleOutput: '11.00 5.74',
    starterCode: "n = int(input())\n# print mean and population standard deviation\n",
    cases: [
      { input: '10\n', output: '11.00 5.74', hidden: false },
      { input: '1\n', output: '2.00 0.00', hidden: true },
      { input: '5\n', output: '6.00 2.83', hidden: true }
    ]
  },
  {
    title: 'Matrix Row and Column Sums',
    category: 'Advanced Python',
    topic: 'Numerical Arrays',
    difficulty: 'Medium',
    statement:
      'Unit 4 asks for a 4x4 matrix and computing row and column sums.\n\nRead a 4x4 matrix. Print row sums on one line and column sums on the next line.',
    constraints: 'Exactly 4 lines follow, each containing 4 integers.',
    sampleInput: '1 2 3 4\n5 6 7 8\n9 10 11 12\n13 14 15 16\n',
    sampleOutput: '10 26 42 58\n28 32 36 40',
    starterCode: "matrix = [list(map(int, input().split())) for _ in range(4)]\n# print row sums and column sums\n",
    cases: [
      { input: '1 2 3 4\n5 6 7 8\n9 10 11 12\n13 14 15 16\n', output: '10 26 42 58\n28 32 36 40', hidden: false },
      { input: '1 1 1 1\n2 2 2 2\n3 3 3 3\n4 4 4 4\n', output: '4 8 12 16\n10 10 10 10', hidden: true },
      { input: '0 0 0 0\n1 2 3 4\n4 3 2 1\n9 8 7 6\n', output: '0 10 10 30\n14 13 12 11', hidden: true }
    ]
  },
  {
    title: 'CSV Student Marks Formatter',
    category: 'Intermediate Python',
    topic: 'CSV Files',
    difficulty: 'Easy',
    statement:
      'Unit 5 asks for reading CSV data containing student names and marks and displaying it in a formatted table.\n\nRead n, then n CSV rows as name,marks. Print each row as name: marks.',
    constraints: 'Names do not contain commas.',
    sampleInput: '2\nAsha,90\nRavi,75\n',
    sampleOutput: 'Asha: 90\nRavi: 75',
    starterCode: "import csv\nn = int(input())\n# parse CSV rows and print formatted table\n",
    cases: [
      { input: '2\nAsha,90\nRavi,75\n', output: 'Asha: 90\nRavi: 75', hidden: false },
      { input: '1\nSita,100\n', output: 'Sita: 100', hidden: true },
      { input: '3\nA,1\nB,2\nC,3\n', output: 'A: 1\nB: 2\nC: 3', hidden: true }
    ]
  },
  {
    title: 'CSV Sales Total',
    category: 'Intermediate Python',
    topic: 'CSV Files',
    difficulty: 'Medium',
    statement:
      'Unit 5 asks for reading sales data, calculating total sales, and writing the result to another CSV. In this sandbox, print the result.\n\nRead n, then n rows item,amount. Print Total,<sum>.',
    constraints: 'Amounts are integers.',
    sampleInput: '3\nPen,10\nBook,50\nBag,400\n',
    sampleOutput: 'Total,460',
    starterCode: "import csv\nn = int(input())\n# calculate total sales and print Total,<sum>\n",
    cases: [
      { input: '3\nPen,10\nBook,50\nBag,400\n', output: 'Total,460', hidden: false },
      { input: '2\nA,5\nB,7\n', output: 'Total,12', hidden: true },
      { input: '0\n', output: 'Total,0', hidden: true }
    ]
  },
  {
    title: 'Filter Rows Above Threshold',
    category: 'Intermediate Python',
    topic: 'CSV Files',
    difficulty: 'Medium',
    statement:
      'Unit 5 asks for filtering CSV rows where a numeric column value exceeds a threshold.\n\nRead threshold, n, then n rows name,value. Print names whose value is greater than threshold, one per line. Print NONE if no rows match.',
    constraints: 'Values are integers.',
    sampleInput: '50\n4\nAsha,70\nRavi,45\nOm,51\nMira,50\n',
    sampleOutput: 'Asha\nOm',
    starterCode: "threshold = int(input())\nn = int(input())\n# print names with value greater than threshold\n",
    cases: [
      { input: '50\n4\nAsha,70\nRavi,45\nOm,51\nMira,50\n', output: 'Asha\nOm', hidden: false },
      { input: '10\n2\nA,5\nB,7\n', output: 'NONE', hidden: true },
      { input: '0\n2\nA,1\nB,0\n', output: 'A', hidden: true }
    ]
  },
  {
    title: 'Missing Value Counts',
    category: 'Advanced Python',
    topic: 'Data Preprocessing',
    difficulty: 'Medium',
    statement:
      'Unit 6 asks for identifying columns containing missing values using Pandas. In this sandbox, process CSV-like input directly.\n\nRead rows and columns, then a header row, then data rows. Empty cells or NA are missing. Print column_name missing_count for columns with missing values.',
    constraints: 'Cells are comma-separated. At least one column has missing data.',
    sampleInput: '3 3\nname,age,city\nAsha,20,Pune\nRavi,NA,\nOm,,Mumbai\n',
    sampleOutput: 'age 2\ncity 1',
    starterCode: "rows, cols = map(int, input().split())\nheader = input().split(',')\n# count missing values per column\n",
    cases: [
      { input: '3 3\nname,age,city\nAsha,20,Pune\nRavi,NA,\nOm,,Mumbai\n', output: 'age 2\ncity 1', hidden: false },
      { input: '2 2\na,b\n,1\nNA,\n', output: 'a 2\nb 1', hidden: true },
      { input: '2 3\nx,y,z\n1,2,3\n4,,NA\n', output: 'y 1\nz 1', hidden: true }
    ]
  },
  {
    title: 'Missing Value Percentage',
    category: 'Advanced Python',
    topic: 'Data Preprocessing',
    difficulty: 'Medium',
    statement:
      'Unit 6 asks for determining the percentage of missing values in each column.\n\nRead rows and columns, header, and data. Print each column with missing percentage rounded to 2 decimals: column percentage',
    constraints: 'Missing cells are empty or NA.',
    sampleInput: '4 2\nname,marks\nAsha,90\nRavi,\nOm,NA\nMira,80\n',
    sampleOutput: 'name 0.00\nmarks 50.00',
    starterCode: "rows, cols = map(int, input().split())\nheader = input().split(',')\n# print missing percentage per column\n",
    cases: [
      { input: '4 2\nname,marks\nAsha,90\nRavi,\nOm,NA\nMira,80\n', output: 'name 0.00\nmarks 50.00', hidden: false },
      { input: '2 2\na,b\n,\n1,2\n', output: 'a 50.00\nb 50.00', hidden: true },
      { input: '1 3\na,b,c\n1,2,3\n', output: 'a 0.00\nb 0.00\nc 0.00', hidden: true }
    ]
  },
  {
    title: 'Mean Median Standard Deviation',
    category: 'Advanced Python',
    topic: 'Data Exploration',
    difficulty: 'Medium',
    statement:
      'Unit 6 asks for calculating mean, median, and standard deviation of a numerical column.\n\nRead n and n numbers. Print mean, median, and population standard deviation rounded to 2 decimals.',
    constraints: '1 <= n <= 1000.',
    sampleInput: '5\n10 20 30 40 50\n',
    sampleOutput: '30.00 30.00 14.14',
    starterCode: "n = int(input())\nvalues = list(map(float, input().split()))\n# print mean median population-standard-deviation\n",
    cases: [
      { input: '5\n10 20 30 40 50\n', output: '30.00 30.00 14.14', hidden: false },
      { input: '4\n1 2 3 4\n', output: '2.50 2.50 1.12', hidden: true },
      { input: '1\n7\n', output: '7.00 7.00 0.00', hidden: true }
    ]
  },
  {
    title: 'Top Five Values in Column',
    category: 'Advanced Python',
    topic: 'Data Exploration',
    difficulty: 'Easy',
    statement:
      'Unit 6 asks for finding the top 5 highest values in a specified numeric column.\n\nRead n and n integers. Print the top five values in descending order. If fewer than five values exist, print all.',
    constraints: '1 <= n <= 1000.',
    sampleInput: '7\n10 90 30 70 50 20 80\n',
    sampleOutput: '90 80 70 50 30',
    starterCode: "n = int(input())\nvalues = list(map(int, input().split()))\n# print top five values descending\n",
    cases: [
      { input: '7\n10 90 30 70 50 20 80\n', output: '90 80 70 50 30', hidden: false },
      { input: '3\n5 1 9\n', output: '9 5 1', hidden: true },
      { input: '5\n1 1 2 2 3\n', output: '3 2 2 1 1', hidden: true }
    ]
  },
  {
    title: 'Most Frequent Category',
    category: 'Advanced Python',
    topic: 'Data Exploration',
    difficulty: 'Easy',
    statement:
      'Unit 6 asks for finding which category appears most frequently in a categorical column.\n\nRead n and n category names. Print the most frequent category. If tied, print alphabetically smallest.',
    constraints: 'Category names have no spaces.',
    sampleInput: '6\nA B A C B A\n',
    sampleOutput: 'A',
    starterCode: "n = int(input())\ncategories = input().split()\n# print most frequent category\n",
    cases: [
      { input: '6\nA B A C B A\n', output: 'A', hidden: false },
      { input: '4\nz y y z\n', output: 'y', hidden: true },
      { input: '1\nPython\n', output: 'Python', hidden: true }
    ]
  },
  {
    title: 'Outliers Using IQR Method',
    category: 'Advanced Python',
    topic: 'Outlier Handling',
    difficulty: 'Hard',
    statement:
      'Unit 6 asks for detecting outliers with the IQR method.\n\nRead n and n sorted or unsorted numbers. Use median-of-halves quartiles. Print outliers in original order, or NONE.',
    constraints: '4 <= n <= 1000.',
    sampleInput: '6\n10 12 11 13 100 9\n',
    sampleOutput: '100',
    starterCode: "n = int(input())\nvalues = list(map(float, input().split()))\n# print IQR outliers in original order\n",
    cases: [
      { input: '6\n10 12 11 13 100 9\n', output: '100', hidden: false },
      { input: '5\n1 2 3 4 5\n', output: 'NONE', hidden: true },
      { input: '8\n10 10 11 12 13 14 100 -50\n', output: '100 -50', hidden: true }
    ]
  },
  {
    title: 'Label Encoding Categories',
    category: 'Advanced Python',
    topic: 'Encoding',
    difficulty: 'Medium',
    statement:
      'Unit 6 asks for studying label encoding and one-hot encoding. This task implements label encoding.\n\nRead n categories. Assign labels in alphabetical order starting from 0. Print encoded values in original order.',
    constraints: 'Category names have no spaces.',
    sampleInput: '5\nred blue red green blue\n',
    sampleOutput: '2 0 2 1 0',
    starterCode: "n = int(input())\nitems = input().split()\n# label encode alphabetically\n",
    cases: [
      { input: '5\nred blue red green blue\n', output: '2 0 2 1 0', hidden: false },
      { input: '3\nA A B\n', output: '0 0 1', hidden: true },
      { input: '4\nz y x z\n', output: '2 1 0 2', hidden: true }
    ]
  },
  {
    title: 'Correlation Between Two Columns',
    category: 'Advanced Python',
    topic: 'Data Exploration',
    difficulty: 'Hard',
    statement:
      'Unit 6 asks for examining correlation between two numeric columns.\n\nRead n, then n x-values and n y-values. Print Pearson correlation rounded to 2 decimals.',
    constraints: '2 <= n <= 1000. Standard deviation of both lists is non-zero.',
    sampleInput: '5\n1 2 3 4 5\n2 4 6 8 10\n',
    sampleOutput: '1.00',
    starterCode: "n = int(input())\nx = list(map(float, input().split()))\ny = list(map(float, input().split()))\n# print Pearson correlation rounded to 2 decimals\n",
    cases: [
      { input: '5\n1 2 3 4 5\n2 4 6 8 10\n', output: '1.00', hidden: false },
      { input: '5\n1 2 3 4 5\n10 8 6 4 2\n', output: '-1.00', hidden: true },
      { input: '4\n1 2 3 4\n1 3 2 4\n', output: '0.90', hidden: true }
    ]
  }
];

export function buildQuestionSeed() {
  return syllabusSpecs.map(withDefaults);
}
