import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import {FormsModule} from '@angular/forms';
import highs from 'highs';
import { ConstraintsService } from '../constraints.service';
import { UmformungService } from '../umformung.service';
import { ModelComponent } from '../model/model.component';


@Component({
  selector: 'app-highs-solver',
  standalone: true,
  imports: [CommonModule, FormsModule, ModelComponent],
  templateUrl: './highs-solver.component.html',
  styleUrl: './highs-solver.component.css'
})
export class HighsSolverComponent {
  problemInput= '';  // Eingabefeld f�r das Problem, standardm��ig leer
  solution = '';  // Variable zur Anzeige der L�sung

  constructor(private constraintsService: ConstraintsService, private umformungService: UmformungService) {}

  // Methode zur L�sung des Benutzerproblems
  async solveProblem(): Promise<void> {

    const LP = this.umformungService.umformen(this.problemInput);

    // Initialisiere den HiGHS Solver und passe locateFile an
    const highs_settings = {
      locateFile: (file: string) => `highs/${file}`  // Zeigt auf den Ordner, wo die WASM-Datei liegt
    };

    try {
      // HiGHS-Solver mit den definierten Einstellungen laden
      const highsSolver = await highs(highs_settings);

      // L�sen des vom Benutzer eingegebenen Problems
      var result;
      try{
        result = highsSolver.solve(this.problemInput);
      }
      catch (error){
        result = highsSolver.solve(LP);
      }

      

       // F�ge die Constraints in den ConstraintsService hinzu
       var constraints
       try{
        constraints = this.parseConstraints(this.problemInput);
       }
       catch(error){
        constraints = this.parseConstraints(LP);
       }
       this.constraintsService.setConstraints(constraints);
       
       // Benachrichtige die Abonnenten
       this.constraintsService.constraintsUpdated.next();  
     
      // Ergebnis als JSON speichern und anzeigen
      this.solution = JSON.stringify(result, null, 2);
    } catch (error) {
      // Fehlerbehandlung
      console.error('Fehler beim L�sen des Problems:', error);
      this.solution = 'Fehler beim L�sen des Problems: ' + error;
    }
  }


// Methode zum Parsen der Constraints aus dem Problemstring
private parseConstraints(problem: string): any[] {
    const constraints = [];
    const lines = problem.split('\n').filter(line => line.trim() !== '');

    let isObjective = true; // Flag zum Erkennen, ob wir noch im Zielbereich sind
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine.startsWith('Maximize') || trimmedLine.startsWith('Minimize')) {
        isObjective = false; // Wechsel zu den Constraints
        continue;
      }
      if (isObjective) {
        continue; // �berspringe die Zeilen bis wir die Constraints erreichen
      }
      if (trimmedLine.startsWith('Subject To')) {
        continue; // �berspringe diese Zeile
      }
      if (trimmedLine.startsWith('Bounds')) {
        break; // Wir haben alle Constraints gelesen
      }

      // Hier wird die Zeile als Constraint geparst
      const parts = trimmedLine.split(/<=|>=|=/);
      if (parts.length < 2) {
        continue; // Ung�ltige Zeile, �berspringen
      }

      const lhs = parts[0].trim();
      const rhs = parts[1].trim();
      const relation = trimmedLine.includes('<=') ? '<=' : trimmedLine.includes('>=') ? '>=' : '=';
      constraints.push({
        name: `Constraint ${constraints.length + 1}`, // Benennung der Constraints
        terms: this.parseTerms(lhs),
        relation: relation,
        rhs: parseFloat(rhs),
      });
    }

    return constraints;
  }

  // Hilfsmethode zum Parsen der Terme einer Constraint
  private parseTerms(lhs: string): { name: string; coef: number }[] {
    const terms: { name: string; coef: number }[] = [];
    const termRegex = /([-+]?\d*\.?\d+)?\s*([xy]\d+)/g; // Beispiel f�r Variablen x1, x2, ...
    let match: RegExpExecArray | null;

    while ((match = termRegex.exec(lhs)) !== null) {
      const coef = match[1] ? parseFloat(match[1]) : 1; // Falls kein Koeffizient angegeben ist, nehme 1
      const variable = match[2];
      terms.push({ name: variable, coef: coef });
    }

    return terms;
  }
}
