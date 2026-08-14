# Unit 2 — Important Formulas, Results & Must-Remember Steps

**Subject:** Integral Transforms & Integral Equations (MSC MT-09)  
**Unit:** Unit 2 — The Inverse Laplace Transform

---

## 1. Basic Definition

If
\[
L[f(t);p]=\bar f(p),
\]
then the **inverse Laplace transform** is written as
\[
L^{-1}[\bar f(p);t]=f(t).
\]

### Uniqueness condition
If \(f(t)\) is piecewise continuous on every finite interval \(0\le t\le N\) and is of exponential order for \(t>N\), then its inverse Laplace transform is unique.

---

# 2. Core Formula Table

| Formula / Result | Must remember |
|---|---|
| \(L^{-1}\{1/p\}\) | \(1\) |
| \(L^{-1}\{1/(p-a)\}\) | \(e^{at}\) |
| \(L^{-1}\{p/(p^2+a^2)\}\) | \(\cos at\) |
| \(L^{-1}\{a/(p^2+a^2)\}\) | \(\sin at\) |
| \(L^{-1}\{1/(p^2+a^2)\}\) | \(\frac1a\sin at\) |
| \(L^{-1}\{1/p^{n+1}\}\) | \(t^n/n!\) |
| \(L^{-1}\{1/p^\alpha\}\) | \(t^{\alpha-1}/\Gamma(\alpha)\) |
| \(L^{-1}\{\bar f(p-a)\}\) | \(e^{at}f(t)\) |
| Change of scale | \(L^{-1}\{\bar f(ap)\}=\frac1a f(t/a)\) |
| Convolution | \(L^{-1}\{\bar f(p)\bar g(p)\}=\int_0^t f(u)g(t-u)\,du\) |

---

# 3. Change of Scale Property

If
\[
L^{-1}\{\bar f(p);t\}=f(t),
\]
then
\[
\boxed{L^{-1}\{\bar f(ap);t\}=\frac1a f\left(\frac ta\right)},\qquad a>0.
\]

### Remember the pattern
- \(p\to ap\)
- Multiply by \(1/a\)
- Replace \(t\) by \(t/a\)

### Example pattern
If
\[
L^{-1}\left\{\frac{p^2-1}{(p^2+1)^2}\right\}=t\cos t,
\]
then replacing \(p\) by \(3p\):
\[
L^{-1}\left\{\frac{9p^2-1}{(9p^2+1)^2}\right\}
=\frac13\left(\frac t3\right)\cos\left(\frac t3\right)
=\boxed{\frac{t}{9}\cos\frac t3}.
\]

---

# 4. First Shifting Theorem

If
\[
L^{-1}\{F(p)\}=f(t),
\]
then
\[
\boxed{L^{-1}\{F(p-a)\}=e^{at}f(t)}.
\]

### Must remember
- \(p-a\) → \(e^{at}\)
- \(p+a\) → \(e^{-at}\)

### Example
\[
L^{-1}\left\{\frac5{(p-2)^2+25}\right\}
=e^{2t}\sin5t.
\]

---

# 5. Convolution Product

For two functions \(f(t)\) and \(g(t)\) of class A,
\[
\boxed{f*g=\int_0^t f(u)g(t-u)\,du}
\]

Equivalent form:
\[
\boxed{f*g=\int_0^t f(t-u)g(u)\,du}.
\]

It is also called **Faltung** or the resultant of \(f\) and \(g\).

### Convolution Theorem
\[
\boxed{L^{-1}\{F(p)G(p)\}=f*g}
\]
\[
\boxed{L^{-1}\{F(p)G(p)\}=\int_0^t f(u)g(t-u)\,du}.
\]

### Proof steps to remember
1. Put \(H(t)=\int_0^t f(u)g(t-u)du\).
2. Take \(L[H(t)]\).
3. Change the order of integration.
4. Put \(v=t-u\).
5. Separate the factors.
6. Obtain \(F(p)G(p)\).

---

# 6. Derivative-with-respect-to-p Rule

If
\[
L[f(t);p]=F(p),
\]
then
\[
\boxed{L[tf(t);p]=-\frac{dF(p)}{dp}}.
\]

Therefore,
\[
\boxed{L^{-1}\left\{\frac{dF}{dp}\right\}=-tf(t)}.
\]

### Higher powers
\[
L[t^n f(t)]=(-1)^n\frac{d^n}{dp^n}F(p).
\]

This is especially useful for inverse transforms containing derivatives with respect to \(p\).

---

# 7. Important Inverse Transforms with Powers

\[
L^{-1}\left\{\frac1{p^n}\right\}=\frac{t^{n-1}}{(n-1)!}.
\]

More generally,
\[
\boxed{L^{-1}\left\{\frac1{p^\alpha}\right\}=\frac{t^{\alpha-1}}{\Gamma(\alpha)}}.
\]

Useful Gamma values:
\[
\Gamma\left(\frac12\right)=\sqrt\pi,
\]
\[
\Gamma\left(\frac32\right)=\frac12\sqrt\pi,
\]
\[
\Gamma\left(\frac52\right)=\frac34\sqrt\pi,
\]
\[
\Gamma\left(\frac72\right)=\frac{15}{8}\sqrt\pi.
\]

---

# 8. Bessel Function Result

A key result used in Unit 2 is
\[
\boxed{L[J_0(at);p]=\frac1{\sqrt{p^2+a^2}}}.
\]

Differentiating with respect to \(a\):
\[
L[tJ_0'(at);p]=\frac{a}{(p^2+a^2)^{3/2}}.
\]

Since
\[
J_0'(x)=-J_1(x),
\]
we get
\[
\boxed{L^{-1}\left\{\frac{a}{(p^2+a^2)^{3/2}}\right\}=\frac{t}{a}J_1(at)}.
\]

Hence,
\[
\boxed{L^{-1}\left\{\frac1{(p^2+a^2)^{3/2}}\right\}=\frac{t}{a}J_1(at)}.
\]

Example:
\[
L^{-1}\left\{\frac1{(p^2+2p+5)^{3/2}}\right\}
=\frac{te^{-t}}2J_1(2t).
\]

---

# 9. Exponential Shifting in Complicated Quadratics

Always complete the square first.

Example:
\[
p^2+2p+5=(p+1)^2+4.
\]

Then use
\[
F(p+1)\longrightarrow e^{-t}f(t).
\]

### Step pattern
1. Complete the square.
2. Identify \(p+a\).
3. Remove the shift.
4. Find the basic inverse transform.
5. Multiply by \(e^{-at}\).

---

# 10. Logarithmic Inverse Transform

For
\[
F(p)=\log\left(1+\frac1{p^2}\right),
\]
use differentiation with respect to \(p\).

Rewrite:
\[
F(p)=\log(p^2+1)-2\log p.
\]

Then
\[
F'(p)=\frac{2p}{p^2+1}-\frac2p.
\]

Using
\[
L^{-1}\{F'(p)\}=-tf(t),
\]
we obtain
\[
-tf(t)=2\cos t-2,
\]
so
\[
\boxed{L^{-1}\left\{\log\left(1+\frac1{p^2}\right)\right\}=\frac{2(1-\cos t)}t}.
\]

### Memory trick
For logarithmic expressions in \(p\), **differentiate first**, invert the simpler expression, then divide by \(-t\).

---

# 11. Inverse Transform of \(\cot^{-1}(p+1)\)

Let
\[
F(p)=\cot^{-1}(p+1).
\]
Then
\[
F'(p)=-\frac1{1+(p+1)^2}.
\]

Therefore,
\[
-tf(t)=-e^{-t}\sin t,
\]
so
\[
\boxed{L^{-1}\{\cot^{-1}(p+1)\}=\frac{e^{-t}\sin t}{t}}.
\]

---

# 12. Important Standard Result

\[
\boxed{L^{-1}\left\{\frac{e^{-1/p}}{\sqrt p}\right\}
=\frac{\cos(2\sqrt t)}{\sqrt{\pi t}}}.
\]

### Series method
Use
\[
e^{-1/p}=1-\frac1p+\frac1{2!p^2}-\frac1{3!p^3}+\cdots
\]
and multiply by \(p^{-1/2}\).

Then invert term-by-term using
\[
L^{-1}\{p^{-\alpha}\}=\frac{t^{\alpha-1}}{\Gamma(\alpha)}.
\]

Recognize the resulting series as
\[
\cos(2\sqrt t).
\]

---

# 13. Important Dirichlet Conditions

For the Fourier-series context, the commonly stated conditions used in the supplied text are:

1. \(f(t)\) is defined over the required finite interval.
2. \(f(t)\) and \(f'(t)\) are piecewise continuous.
3. \(f(t)\) is periodic with the stated period.

These are **sufficient, but not necessary**, conditions for convergence of a Fourier series.

---

# 14. Null Function

If \(N(t)\) satisfies
\[
\boxed{\int_0^t N(u)\,du=0,\qquad \forall t>0},
\]
then \(N(t)\) is called a **null function**.

Remember: its integral from \(0\) to any positive \(t\) is zero.

---

# 15. Frequently Used Algebraic Patterns

### Complete the square
\[
p^2+2ap+(a^2+b^2)=(p+a)^2+b^2.
\]

### Split numerator
For example,
\[
p=(p+a)-a.
\]
This allows a shifted standard form to be used.

### Factor denominator before choosing a theorem
Always try:
- complete the square;
- factor numerator/denominator;
- identify \(p-a\) or \(p+a\);
- identify a standard sine/cosine form;
- identify a power of \(p\).

---

# 16. Exam-Solving Checklist

When an inverse Laplace question appears:

1. **Look for a shift:** \(p-a\) or \(p+a\).
2. **Complete the square** in quadratic denominators.
3. **Match standard forms** for \(\sin\), \(\cos\), exponentials and powers.
4. If there is a product, think **convolution**.
5. If there is \(F'(p)\), use \(L^{-1}\{F'(p)\}=-tf(t)\).
6. If there is \(p^{-\alpha}\), use the **Gamma formula**.
7. If \((p^2+a^2)^{3/2}\) appears, think **Bessel \(J_1\)**.
8. For \(e^{-1/p}\), consider **series expansion**.
9. Simplify the final expression only after applying the correct theorem.
10. Check signs, constants, and powers of \(t\) before finalizing.

---

# 17. High-Priority Results for VMOU Exam

Memorize these first:

\[
\boxed{L^{-1}\{F(p-a)\}=e^{at}f(t)}
\]

\[
\boxed{L^{-1}\{F(ap)\}=\frac1a f(t/a)}
\]

\[
\boxed{L^{-1}\{F(p)G(p)\}=\int_0^t f(u)g(t-u)du}
\]

\[
\boxed{L^{-1}\{F'(p)\}=-tf(t)}
\]

\[
\boxed{L^{-1}\{p^{-\alpha}\}=\frac{t^{\alpha-1}}{\Gamma(\alpha)}}
\]

\[
\boxed{L^{-1}\left\{\frac{a}{(p^2+a^2)^{3/2}}\right\}=\frac{t}{a}J_1(at)}
\]

\[
\boxed{L^{-1}\left\{\frac{e^{-1/p}}{\sqrt p}\right\}=\frac{\cos(2\sqrt t)}{\sqrt{\pi t}}}
\]

\[
\boxed{L^{-1}\left\{\log\left(1+\frac1{p^2}\right)\right\}=\frac{2(1-\cos t)}t}
\]

\[
\boxed{L^{-1}\{\cot^{-1}(p+1)\}=\frac{e^{-t}\sin t}{t}}
\]

---

## Final Memory Map

**Shift → Scale → Complete square → Standard form → Differentiate in p → Gamma/Bessel → Convolution → Series**

This sequence covers most of the recurring techniques used in the Unit 2 questions studied in this chat.
