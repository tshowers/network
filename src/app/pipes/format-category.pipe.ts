import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'formatCategory',
  standalone: true
})
export class FormatCategoryPipe implements PipeTransform {

  transform(category: string | string[] | null | undefined): string {
    if (!category) {
      return ''; // Return empty string for null or undefined
    }
    if (Array.isArray(category)) {
      return category.join(', '); // Join array elements with a comma
    }
    return category; // Return the string as is
  }

}
